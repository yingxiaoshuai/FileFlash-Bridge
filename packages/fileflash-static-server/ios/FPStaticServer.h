#import <React/RCTEventEmitter.h>

#import "GCDWebServer.h"
#import "GCDWebServerDataRequest.h"
#import "GCDWebServerDataResponse.h"
#import "GCDWebServerFunctions.h"
#import "GCDWebServerHTTPStatusCodes.h"

@interface FPStaticServer : RCTEventEmitter <RCTBridgeModule> {
    GCDWebServer* _webServer;
}

@property(nonatomic, retain) NSString *localPath;
@property(nonatomic, retain) NSString *url;

@property (nonatomic, retain) NSString* www_root;
@property (nonatomic, retain) NSNumber* port;
@property (assign) BOOL localhost_only;
@property (assign) BOOL keep_alive;

@end
