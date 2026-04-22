#import <Foundation/Foundation.h>
#import <PhotosUI/PhotosUI.h>
#import <React/RCTBridgeModule.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#import <UIKit/UIKit.h>

static NSString *const FFBAppGroupFallback = @"group.com.first.fileflashbridge";

static NSString *FFBISO8601String(void)
{
  static NSISO8601DateFormatter *formatter = nil;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    formatter = [NSISO8601DateFormatter new];
    formatter.formatOptions = NSISO8601DateFormatWithInternetDateTime;
  });

  return [formatter stringFromDate:[NSDate date]];
}

static UIViewController *FFBTopViewController(void)
{
  UIWindow *targetWindow = nil;
  NSSet<UIScene *> *connectedScenes = [UIApplication sharedApplication].connectedScenes;
  for (UIScene *scene in connectedScenes) {
    if (![scene isKindOfClass:[UIWindowScene class]]) {
      continue;
    }

    UIWindowScene *windowScene = (UIWindowScene *)scene;
    for (UIWindow *window in windowScene.windows) {
      if (window.isKeyWindow) {
        targetWindow = window;
        break;
      }
    }

    if (targetWindow != nil) {
      break;
    }
  }

  targetWindow = targetWindow ?: [UIApplication sharedApplication].delegate.window;
  UIViewController *controller = targetWindow.rootViewController;
  while (controller.presentedViewController != nil) {
    controller = controller.presentedViewController;
  }

  return controller;
}

static NSString *FFBSanitizeFileName(NSString *candidate)
{
  NSCharacterSet *invalidCharacters = [NSCharacterSet characterSetWithCharactersInString:@"<>:\"/\\|?*\n\r\t"];
  NSArray<NSString *> *parts = [candidate componentsSeparatedByCharactersInSet:invalidCharacters];
  NSString *sanitized = [[parts componentsJoinedByString:@"_"] stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
  return sanitized.length > 0 ? sanitized : @"shared-item";
}

@interface FPInboundSharing : NSObject <RCTBridgeModule, PHPickerViewControllerDelegate>

@property (nonatomic, copy) RCTPromiseRejectBlock mediaReject;
@property (nonatomic, copy) RCTPromiseResolveBlock mediaResolve;

@end

@implementation FPInboundSharing

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

RCT_REMAP_METHOD(
  pickMediaFiles,
  pickMediaFilesWithResolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject)
{
  if (self.mediaResolve != nil || self.mediaReject != nil) {
    reject(@"E_PICKER_BUSY", @"Media picker is already active.", nil);
    return;
  }

  UIViewController *controller = FFBTopViewController();
  if (controller == nil) {
    reject(@"E_NO_ACTIVITY", @"No visible view controller is available for media picking.", nil);
    return;
  }

  PHPickerConfiguration *configuration = [[PHPickerConfiguration alloc] init];
  configuration.selectionLimit = 0;
  configuration.filter = [PHPickerFilter anyFilterMatchingSubfilters:@[
    [PHPickerFilter imagesFilter],
    [PHPickerFilter videosFilter],
  ]];

  PHPickerViewController *picker = [[PHPickerViewController alloc] initWithConfiguration:configuration];
  picker.delegate = self;

  self.mediaResolve = resolve;
  self.mediaReject = reject;
  [controller presentViewController:picker animated:YES completion:nil];
}

RCT_REMAP_METHOD(
  consumePendingSharedItems,
  consumePendingSharedItemsWithResolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSError *error = nil;
  NSDictionary *payload = [self readPendingSharedItems:&error];
  if (payload == nil) {
    reject(@"E_SHARE_READ_FAILED", error.localizedDescription ?: @"Unable to read pending shared items.", error);
    return;
  }

  resolve(payload);
}

- (void)picker:(PHPickerViewController *)picker didFinishPicking:(NSArray<PHPickerResult *> *)results
{
  RCTPromiseResolveBlock resolve = self.mediaResolve;
  RCTPromiseRejectBlock reject = self.mediaReject;
  self.mediaResolve = nil;
  self.mediaReject = nil;

  [picker dismissViewControllerAnimated:YES completion:nil];

  if (resolve == nil || reject == nil) {
    return;
  }

  if (results.count == 0) {
    reject(@"E_PICKER_CANCELLED", @"User cancelled media selection.", nil);
    return;
  }

  dispatch_group_t group = dispatch_group_create();
  NSMutableArray<NSDictionary *> *items = [NSMutableArray arrayWithCapacity:results.count];
  __block NSError *firstError = nil;
  NSString *createdAt = FFBISO8601String();

  for (PHPickerResult *result in results) {
    dispatch_group_enter(group);
    [self loadPickerResult:result
                 createdAt:createdAt
                completion:^(NSDictionary * _Nullable item, NSError * _Nullable error) {
      if (item != nil) {
        @synchronized(items) {
          [items addObject:item];
        }
      } else if (error != nil && firstError == nil) {
        firstError = error;
      }

      dispatch_group_leave(group);
    }];
  }

  dispatch_group_notify(group, dispatch_get_main_queue(), ^{
    if (firstError != nil) {
      reject(@"E_PICKER_FAILED", firstError.localizedDescription ?: @"Media import failed.", firstError);
      return;
    }

    resolve(items);
  });
}

- (void)loadPickerResult:(PHPickerResult *)result
               createdAt:(NSString *)createdAt
              completion:(void (^)(NSDictionary *_Nullable item, NSError *_Nullable error))completion
{
  NSItemProvider *provider = result.itemProvider;
  NSString *typeIdentifier = [self preferredTypeIdentifierForProvider:provider];
  if (typeIdentifier.length == 0) {
    NSError *error = [NSError errorWithDomain:@"FPInboundSharing"
                                         code:1001
                                     userInfo:@{NSLocalizedDescriptionKey: @"Unsupported picker item."}];
    completion(nil, error);
    return;
  }

  [provider loadFileRepresentationForTypeIdentifier:typeIdentifier
                                  completionHandler:^(NSURL * _Nullable url, NSError * _Nullable error) {
    if (error != nil || url == nil) {
      completion(nil, error ?: [NSError errorWithDomain:@"FPInboundSharing"
                                                   code:1002
                                               userInfo:@{NSLocalizedDescriptionKey: @"Unable to load the selected media item."}]);
      return;
    }

    NSError *copyError = nil;
    NSDictionary *item = [self createImportedFileFromURL:url
                                                provider:provider
                                          typeIdentifier:typeIdentifier
                                               createdAt:createdAt
                                                   error:&copyError];
    completion(item, copyError);
  }];
}

- (NSDictionary *)createImportedFileFromURL:(NSURL *)sourceURL
                                   provider:(NSItemProvider *)provider
                             typeIdentifier:(NSString *)typeIdentifier
                                  createdAt:(NSString *)createdAt
                                      error:(NSError **)error
{
  NSString *fileName = [self preferredFileNameForProvider:provider sourceURL:sourceURL typeIdentifier:typeIdentifier];
  NSURL *destinationURL = [self nextImportURLForFileName:fileName];
  NSFileManager *fileManager = [NSFileManager defaultManager];

  [fileManager createDirectoryAtURL:[destinationURL URLByDeletingLastPathComponent]
        withIntermediateDirectories:YES
                         attributes:nil
                              error:nil];
  [fileManager removeItemAtURL:destinationURL error:nil];

  if (![fileManager copyItemAtURL:sourceURL toURL:destinationURL error:error]) {
    return nil;
  }

  NSDictionary<NSFileAttributeKey, id> *attributes =
    [fileManager attributesOfItemAtPath:destinationURL.path error:error];
  if (attributes == nil) {
    return nil;
  }

  NSString *mimeType = nil;
  if (@available(iOS 14.0, *)) {
    mimeType = [UTType typeWithIdentifier:typeIdentifier].preferredMIMEType;
  }

  return @{
    @"byteLength": attributes[NSFileSize] ?: @(0),
    @"createdAt": createdAt,
    @"mimeType": mimeType ?: [NSNull null],
    @"name": fileName,
    @"relativePath": fileName,
    @"sourcePath": destinationURL.path,
  };
}

- (NSDictionary *)readPendingSharedItems:(NSError **)error
{
  NSMutableArray<NSDictionary *> *files = [NSMutableArray array];
  NSMutableArray<NSDictionary *> *texts = [NSMutableArray array];

  NSURL *incomingRoot = [self incomingSharesRootURL];
  if (incomingRoot == nil) {
    return @{
      @"files": files,
      @"texts": texts,
    };
  }

  NSArray<NSURL *> *shareDirectories =
    [[NSFileManager defaultManager] contentsOfDirectoryAtURL:incomingRoot
                                  includingPropertiesForKeys:nil
                                                     options:NSDirectoryEnumerationSkipsHiddenFiles
                                                       error:error];
  if (shareDirectories == nil) {
    return nil;
  }

  for (NSURL *directoryURL in shareDirectories) {
    NSURL *manifestURL = [directoryURL URLByAppendingPathComponent:@"manifest.json"];
    NSData *manifestData = [NSData dataWithContentsOfURL:manifestURL options:0 error:nil];
    if (manifestData.length == 0) {
      continue;
    }

    NSArray<NSDictionary *> *entries =
      [NSJSONSerialization JSONObjectWithData:manifestData options:0 error:nil];
    if (![entries isKindOfClass:[NSArray class]]) {
      continue;
    }

    for (NSDictionary *entry in entries) {
      NSString *kind = entry[@"kind"];
      if ([kind isEqualToString:@"file"]) {
        NSString *path = entry[@"sourcePath"];
        if (path.length == 0 || ![[NSFileManager defaultManager] fileExistsAtPath:path]) {
          continue;
        }

        [files addObject:@{
          @"byteLength": entry[@"byteLength"] ?: @(0),
          @"createdAt": entry[@"createdAt"] ?: FFBISO8601String(),
          @"mimeType": entry[@"mimeType"] ?: [NSNull null],
          @"name": entry[@"name"] ?: [path lastPathComponent],
          @"relativePath": entry[@"relativePath"] ?: [path lastPathComponent],
          @"sourcePath": path,
        }];
      } else if ([kind isEqualToString:@"text"]) {
        NSString *content = entry[@"content"];
        if (content.length == 0) {
          continue;
        }

        [texts addObject:@{
          @"content": content,
          @"createdAt": entry[@"createdAt"] ?: FFBISO8601String(),
        }];
      }
    }

    [[NSFileManager defaultManager] removeItemAtURL:manifestURL error:nil];
  }

  return @{
    @"files": files,
    @"texts": texts,
  };
}

- (NSString *)preferredTypeIdentifierForProvider:(NSItemProvider *)provider
{
  if (@available(iOS 14.0, *)) {
    NSArray<NSString *> *preferredTypes = @[
      UTTypeMovie.identifier,
      UTTypeImage.identifier,
      UTTypeAudio.identifier,
      UTTypePDF.identifier,
      UTTypeArchive.identifier,
      UTTypeData.identifier,
      UTTypeItem.identifier,
    ];

    for (NSString *candidate in preferredTypes) {
      if ([provider hasItemConformingToTypeIdentifier:candidate]) {
        return candidate;
      }
    }
  }

  return provider.registeredTypeIdentifiers.firstObject;
}

- (NSString *)preferredFileNameForProvider:(NSItemProvider *)provider
                                 sourceURL:(NSURL *)sourceURL
                            typeIdentifier:(NSString *)typeIdentifier
{
  NSString *baseName = provider.suggestedName;
  if (baseName.length == 0) {
    baseName = sourceURL.lastPathComponent.stringByDeletingPathExtension;
  }
  baseName = FFBSanitizeFileName(baseName.length > 0 ? baseName : @"shared-item");

  NSString *extension = sourceURL.pathExtension;
  if (extension.length == 0 && @available(iOS 14.0, *)) {
    extension = [UTType typeWithIdentifier:typeIdentifier].preferredFilenameExtension;
  }

  return extension.length > 0 ? [NSString stringWithFormat:@"%@.%@", baseName, extension] : baseName;
}

- (NSURL *)nextImportURLForFileName:(NSString *)fileName
{
  NSURL *rootURL = [NSURL fileURLWithPath:[NSTemporaryDirectory() stringByAppendingPathComponent:@"ffb-inbound"]
                              isDirectory:YES];
  NSString *uniqueName = [NSString stringWithFormat:@"%@-%@-%@",
                          @((long long)([NSDate date].timeIntervalSince1970 * 1000)),
                          NSUUID.UUID.UUIDString,
                          fileName];
  return [rootURL URLByAppendingPathComponent:uniqueName];
}

- (NSURL *)incomingSharesRootURL
{
  NSString *appGroupId =
    [[NSBundle mainBundle] objectForInfoDictionaryKey:@"FPAppGroupId"] ?: FFBAppGroupFallback;
  NSURL *containerURL =
    [[NSFileManager defaultManager] containerURLForSecurityApplicationGroupIdentifier:appGroupId];
  if (containerURL == nil) {
    return nil;
  }

  NSURL *incomingRoot = [containerURL URLByAppendingPathComponent:@"IncomingShares" isDirectory:YES];
  [[NSFileManager defaultManager] createDirectoryAtURL:incomingRoot
                           withIntermediateDirectories:YES
                                            attributes:nil
                                                 error:nil];
  return incomingRoot;
}

@end
