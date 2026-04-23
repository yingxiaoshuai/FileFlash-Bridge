#import "FPStaticServer.h"
#include <arpa/inet.h>
#include <ifaddrs.h>
#include <net/if.h>

static BOOL FFBShouldForwardAdditionalHeader(NSString *key)
{
    if (key.length == 0) {
        return NO;
    }

    NSString *normalizedKey = key.lowercaseString;
    static NSSet<NSString *> *managedHeaders = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        managedHeaders = [NSSet setWithArray:@[
            @"cache-control",
            @"connection",
            @"content-length",
            @"content-type",
            @"date",
            @"etag",
            @"last-modified",
            @"server",
            @"transfer-encoding"
        ]];
    });

    return ![managedHeaders containsObject:normalizedKey];
}

@interface FPStaticServer()

@property(nonatomic, assign) BOOL hasListeners;
@property(nonatomic, assign) UIBackgroundTaskIdentifier backgroundTaskIdentifier;
@property(nonatomic, strong) NSMutableDictionary<NSString*, NSDictionary*>* pendingResponses;
@property(nonatomic, strong) NSMutableDictionary<NSString*, dispatch_semaphore_t>* pendingSemaphores;

@end

@implementation FPStaticServer

@synthesize bridge = _bridge;

RCT_EXPORT_MODULE();

- (instancetype)init {
    if((self = [super init])) {
        [GCDWebServer self];
        _webServer = [[GCDWebServer alloc] init];
        _backgroundTaskIdentifier = UIBackgroundTaskInvalid;
        _pendingResponses = [NSMutableDictionary new];
        _pendingSemaphores = [NSMutableDictionary new];
        [[NSNotificationCenter defaultCenter] addObserver:self
                                                 selector:@selector(applicationDidEnterBackground:)
                                                     name:UIApplicationDidEnterBackgroundNotification
                                                   object:nil];
        [[NSNotificationCenter defaultCenter] addObserver:self
                                                 selector:@selector(applicationWillEnterForeground:)
                                                     name:UIApplicationWillEnterForegroundNotification
                                                   object:nil];
    }
    return self;
}

- (void)dealloc {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
    [self endBackgroundTask];
    if(_webServer.isRunning == YES) {
        [_webServer stop];
    }
    _webServer = nil;
}

- (NSArray<NSString *> *)supportedEvents {
    return @[@"fpStaticServerRequest"];
}

- (void)startObserving {
    self.hasListeners = YES;
}

- (void)stopObserving {
    self.hasListeners = NO;
}

- (dispatch_queue_t)methodQueue {
    return dispatch_queue_create("com.futurepress.staticserver", DISPATCH_QUEUE_SERIAL);
}

RCT_EXPORT_METHOD(start: (NSString *)port
                  root:(NSString *)optroot
                  localOnly:(BOOL)localhost_only
                  keepAlive:(BOOL)keep_alive
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {

    if(_webServer.isRunning == YES) {
        resolve([self currentOrigin]);
        return;
    }

    NSString *root;

    if( [optroot isEqualToString:@"DocumentDir"] ){
        root = [NSString stringWithFormat:@"%@", [NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES) objectAtIndex:0] ];
    } else if( [optroot isEqualToString:@"BundleDir"] ){
        root = [NSString stringWithFormat:@"%@", [[NSBundle mainBundle] bundlePath] ];
    } else if([optroot hasPrefix:@"/"]) {
        root = optroot;
    } else {
        root = [NSString stringWithFormat:@"%@/%@", [NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES) objectAtIndex:0], optroot ?: @"" ];
    }

    if(root && [root length] > 0) {
        self.www_root = root;
    }

    if(port && [port length] > 0) {
        NSNumberFormatter *formatter = [[NSNumberFormatter alloc] init];
        formatter.numberStyle = NSNumberFormatterDecimalStyle;
        self.port = [formatter numberFromString:port];
    } else {
        self.port = [NSNumber numberWithInt:-1];
    }

    self.keep_alive = keep_alive;
    self.localhost_only = localhost_only;

    _webServer = [[GCDWebServer alloc] init];

    [self registerBridgeHandlers];

    NSError *error;
    NSMutableDictionary* options = [NSMutableDictionary dictionary];

    if (![self.port isEqualToNumber:[NSNumber numberWithInt:-1]]) {
        [options setObject:self.port forKey:GCDWebServerOption_Port];
    } else {
        [options setObject:[NSNumber numberWithInteger:8080] forKey:GCDWebServerOption_Port];
    }

    if (self.localhost_only == YES) {
        [options setObject:@(YES) forKey:GCDWebServerOption_BindToLocalhost];
    }

    if (self.keep_alive == YES) {
        [options setObject:@(NO) forKey:GCDWebServerOption_AutomaticallySuspendInBackground];
        [options setObject:@2.0 forKey:GCDWebServerOption_ConnectedStateCoalescingInterval];
    }

    if([_webServer startWithOptions:options error:&error]) {
        NSNumber *listenPort = [NSNumber numberWithUnsignedInteger:_webServer.port];
        self.port = listenPort;

        if(_webServer.serverURL == NULL) {
            reject(@"server_error", @"StaticServer could not start", error);
        } else {
            [self updateBackgroundTaskForCurrentApplicationState];
            resolve([self currentOrigin]);
        }
    } else {
        reject(@"server_error", @"StaticServer could not start", error);
    }
}

RCT_EXPORT_METHOD(stop) {
    [self endBackgroundTask];
    if(_webServer.isRunning == YES) {
        [_webServer stop];
    }
}

RCT_EXPORT_METHOD(origin:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
    if(_webServer.isRunning == YES) {
        resolve([self currentOrigin]);
    } else {
        resolve(@"");
    }
}

RCT_EXPORT_METHOD(isRunning:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
    bool isRunning = _webServer != nil && _webServer.isRunning == YES;
    resolve(@(isRunning));
}

RCT_EXPORT_METHOD(respond:(NSString *)requestId
                  status:(nonnull NSNumber *)status
                  headers:(NSDictionary *)headers
                  bodyEncoding:(NSString *)bodyEncoding
                  body:(NSString *)body) {
    dispatch_semaphore_t semaphore = self.pendingSemaphores[requestId];
    if (!semaphore) {
        return;
    }

    self.pendingResponses[requestId] = @{
        @"status": status ?: @500,
        @"headers": headers ?: @{},
        @"bodyEncoding": bodyEncoding ?: @"empty",
        @"body": body ?: @""
    };
    dispatch_semaphore_signal(semaphore);
}

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

- (void)applicationDidEnterBackground:(NSNotification *)notification {
    [self updateBackgroundTaskForCurrentApplicationState];
}

- (void)applicationWillEnterForeground:(NSNotification *)notification {
    [self endBackgroundTask];
}

- (void)updateBackgroundTaskForCurrentApplicationState {
    if (!self.keep_alive || _webServer == nil || _webServer.isRunning != YES) {
        [self endBackgroundTask];
        return;
    }

    UIApplication *application = UIApplication.sharedApplication;
    if (application.applicationState != UIApplicationStateBackground) {
        [self endBackgroundTask];
        return;
    }

    [self beginBackgroundTask];
}

- (void)beginBackgroundTask {
    if (self.backgroundTaskIdentifier != UIBackgroundTaskInvalid) {
        return;
    }

    UIApplication *application = UIApplication.sharedApplication;
    self.backgroundTaskIdentifier =
        [application beginBackgroundTaskWithName:@"FileFlashBridgeStaticServer"
                               expirationHandler:^{
        UIBackgroundTaskIdentifier taskIdentifier = self.backgroundTaskIdentifier;
        self.backgroundTaskIdentifier = UIBackgroundTaskInvalid;
        if (_webServer != nil && _webServer.isRunning == YES) {
            [_webServer stop];
        }
        if (taskIdentifier != UIBackgroundTaskInvalid) {
            [application endBackgroundTask:taskIdentifier];
        }
    }];
}

- (void)endBackgroundTask {
    if (self.backgroundTaskIdentifier == UIBackgroundTaskInvalid) {
        return;
    }

    UIApplication *application = UIApplication.sharedApplication;
    UIBackgroundTaskIdentifier taskIdentifier = self.backgroundTaskIdentifier;
    self.backgroundTaskIdentifier = UIBackgroundTaskInvalid;
    [application endBackgroundTask:taskIdentifier];
}

- (NSString *)currentOrigin {
    if (_webServer == nil || _webServer.isRunning != YES) {
        return @"";
    }

    NSString *host = self.localhost_only ? @"127.0.0.1" : [self currentIPv4Address];
    NSNumber *activePort = self.port ?: @(_webServer.port);
    self.url = [NSString stringWithFormat:@"http://%@:%@", host ?: @"127.0.0.1", activePort];
    return self.url;
}

- (NSString *)currentIPv4Address {
    struct ifaddrs *interfaces = NULL;
    NSString *preferredAddress = nil;
    NSString *fallbackAddress = nil;

    if (getifaddrs(&interfaces) == 0) {
        for (struct ifaddrs *interface = interfaces; interface != NULL; interface = interface->ifa_next) {
            if (interface->ifa_addr == NULL || interface->ifa_addr->sa_family != AF_INET) {
                continue;
            }

            if ((interface->ifa_flags & IFF_LOOPBACK) == IFF_LOOPBACK) {
                continue;
            }

            char addressBuffer[INET_ADDRSTRLEN];
            const struct sockaddr_in *address = (const struct sockaddr_in *)interface->ifa_addr;
            const char *result =
                inet_ntop(AF_INET, &(address->sin_addr), addressBuffer, INET_ADDRSTRLEN);
            if (result == NULL) {
                continue;
            }

            NSString *resolvedAddress = [NSString stringWithUTF8String:addressBuffer];
            NSString *interfaceName =
                interface->ifa_name != NULL
                    ? [NSString stringWithUTF8String:interface->ifa_name]
                    : @"";

            if ([interfaceName isEqualToString:@"en0"] ||
                [interfaceName hasPrefix:@"bridge"] ||
                [interfaceName hasPrefix:@"ap"]) {
                preferredAddress = resolvedAddress;
                break;
            }

            if (fallbackAddress == nil) {
                fallbackAddress = resolvedAddress;
            }
        }

        freeifaddrs(interfaces);
    }

    return preferredAddress ?: fallbackAddress ?: @"127.0.0.1";
}

- (void)registerBridgeHandlers {
    NSArray<NSString *> *methods = @[@"GET", @"POST", @"PUT", @"PATCH", @"DELETE", @"OPTIONS", @"HEAD"];

    for (NSString *method in methods) {
        Class requestClass =
            [@[@"POST", @"PUT", @"PATCH"] containsObject:method]
                ? [GCDWebServerDataRequest class]
                : [GCDWebServerRequest class];

        [_webServer addDefaultHandlerForMethod:method
                                  requestClass:requestClass
                                  processBlock:^GCDWebServerResponse *(GCDWebServerRequest *request) {
            return [self handleBridgeRequest:request];
        }];
    }
}

- (GCDWebServerResponse *)handleBridgeRequest:(GCDWebServerRequest *)request {
    if (!self.hasListeners) {
        return [self jsonErrorResponseWithStatus:kGCDWebServerHTTPStatusCode_ServiceUnavailable
                                         message:@"Native request bridge has no JS listeners."];
    }

    NSString *requestId = [[NSUUID UUID] UUIDString];
    dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
    self.pendingSemaphores[requestId] = semaphore;

    NSMutableDictionary *payload = [NSMutableDictionary dictionary];
    payload[@"requestId"] = requestId;
    payload[@"method"] = request.method ?: @"GET";
    payload[@"path"] = request.path ?: @"/";
    payload[@"headers"] = request.headers ?: @{};
    payload[@"query"] = request.query ?: @{};

    if ([request isKindOfClass:[GCDWebServerDataRequest class]]) {
        NSData *bodyData = ((GCDWebServerDataRequest *)request).data;
        if (bodyData.length > 0) {
            payload[@"bodyBase64"] = [bodyData base64EncodedStringWithOptions:0];
            NSString *bodyText = [[NSString alloc] initWithData:bodyData encoding:NSUTF8StringEncoding];
            if (bodyText) {
                payload[@"bodyText"] = bodyText;
            }
        }
    }

    [self sendEventWithName:@"fpStaticServerRequest" body:payload];

    dispatch_time_t timeout = dispatch_time(DISPATCH_TIME_NOW, (int64_t)(60 * NSEC_PER_SEC));
    if (dispatch_semaphore_wait(semaphore, timeout) != 0) {
        [self.pendingSemaphores removeObjectForKey:requestId];
        [self.pendingResponses removeObjectForKey:requestId];
        return [self jsonErrorResponseWithStatus:kGCDWebServerHTTPStatusCode_GatewayTimeout
                                         message:@"Native request bridge timed out."];
    }

    NSDictionary *responsePayload = self.pendingResponses[requestId];
    [self.pendingSemaphores removeObjectForKey:requestId];
    [self.pendingResponses removeObjectForKey:requestId];
    if (!responsePayload) {
        return [self jsonErrorResponseWithStatus:kGCDWebServerHTTPStatusCode_InternalServerError
                                         message:@"Native request bridge returned no response."];
    }

    return [self responseFromPayload:responsePayload];
}

- (GCDWebServerResponse *)responseFromPayload:(NSDictionary *)payload {
    NSInteger status = [payload[@"status"] integerValue];
    NSDictionary *headers = payload[@"headers"] ?: @{};
    NSString *bodyEncoding = payload[@"bodyEncoding"] ?: @"empty";
    NSString *body = payload[@"body"] ?: @"";

    GCDWebServerResponse *response = nil;

    if ([bodyEncoding isEqualToString:@"base64"]) {
        NSData *data = [[NSData alloc] initWithBase64EncodedString:body options:0] ?: [NSData data];
        NSString *contentType = headers[@"content-type"] ?: @"application/octet-stream";
        GCDWebServerDataResponse *dataResponse =
            [GCDWebServerDataResponse responseWithData:data contentType:contentType];
        dataResponse.statusCode = status;
        response = dataResponse;
    } else if ([bodyEncoding isEqualToString:@"text"]) {
        NSData *data = [body dataUsingEncoding:NSUTF8StringEncoding] ?: [NSData data];
        NSString *contentType = headers[@"content-type"] ?: @"text/plain; charset=utf-8";
        GCDWebServerDataResponse *dataResponse =
            [GCDWebServerDataResponse responseWithData:data contentType:contentType];
        dataResponse.statusCode = status;
        response = dataResponse;
    } else {
        response = [GCDWebServerResponse responseWithStatusCode:status];
    }

    for (NSString *key in headers) {
        if (!FFBShouldForwardAdditionalHeader(key)) {
            continue;
        }

        [response setValue:[NSString stringWithFormat:@"%@", headers[key]]
         forAdditionalHeader:key];
    }

    return response;
}

- (GCDWebServerResponse *)jsonErrorResponseWithStatus:(NSInteger)status
                                              message:(NSString *)message {
    NSData *data = [[NSString stringWithFormat:@"{\"code\":\"INVALID_REQUEST\",\"message\":\"%@\"}",
        [[message ?: @"Unexpected bridge failure." stringByReplacingOccurrencesOfString:@"\\" withString:@"\\\\"]
            stringByReplacingOccurrencesOfString:@"\"" withString:@"\\\""]]
        dataUsingEncoding:NSUTF8StringEncoding];
    GCDWebServerDataResponse *response =
        [GCDWebServerDataResponse responseWithData:data contentType:@"application/json; charset=utf-8"];
    response.statusCode = status;
    return response;
}

@end
