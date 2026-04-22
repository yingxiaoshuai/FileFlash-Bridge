#import "ShareViewController.h"

#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

static NSString *const FFBShareExtensionGroup = @"group.com.first.fileflashbridge";

static NSString *FFBShareISO8601String(void)
{
  static NSISO8601DateFormatter *formatter = nil;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    formatter = [NSISO8601DateFormatter new];
    formatter.formatOptions = NSISO8601DateFormatWithInternetDateTime;
  });

  return [formatter stringFromDate:[NSDate date]];
}

static NSString *FFBShareSanitizeFileName(NSString *candidate)
{
  NSCharacterSet *invalidCharacters = [NSCharacterSet characterSetWithCharactersInString:@"<>:\"/\\|?*\n\r\t"];
  NSArray<NSString *> *parts = [candidate componentsSeparatedByCharactersInSet:invalidCharacters];
  NSString *sanitized = [[parts componentsJoinedByString:@"_"] stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
  return sanitized.length > 0 ? sanitized : @"shared-item";
}

@interface ShareViewController ()

@property (nonatomic, assign) BOOL hasStartedProcessing;
@property (nonatomic, strong) UILabel *statusLabel;
@property (nonatomic, strong) UIActivityIndicatorView *spinner;

@end

@implementation ShareViewController

- (void)viewDidLoad
{
  [super viewDidLoad];

  self.view.backgroundColor = [UIColor systemBackgroundColor];
  self.spinner = [[UIActivityIndicatorView alloc] initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleLarge];
  self.spinner.translatesAutoresizingMaskIntoConstraints = NO;
  [self.spinner startAnimating];

  self.statusLabel = [UILabel new];
  self.statusLabel.translatesAutoresizingMaskIntoConstraints = NO;
  self.statusLabel.numberOfLines = 0;
  self.statusLabel.textAlignment = NSTextAlignmentCenter;
  self.statusLabel.text = @"正在导入到 FileFlash Bridge…";

  [self.view addSubview:self.spinner];
  [self.view addSubview:self.statusLabel];

  [NSLayoutConstraint activateConstraints:@[
    [self.spinner.centerXAnchor constraintEqualToAnchor:self.view.centerXAnchor],
    [self.spinner.centerYAnchor constraintEqualToAnchor:self.view.centerYAnchor constant:-18],
    [self.statusLabel.topAnchor constraintEqualToAnchor:self.spinner.bottomAnchor constant:16],
    [self.statusLabel.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor constant:24],
    [self.statusLabel.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor constant:-24],
  ]];
}

- (void)viewDidAppear:(BOOL)animated
{
  [super viewDidAppear:animated];

  if (self.hasStartedProcessing) {
    return;
  }

  self.hasStartedProcessing = YES;
  [self processSharedItems];
}

- (void)processSharedItems
{
  NSURL *shareRootURL = [self nextShareDirectoryURL];
  if (shareRootURL == nil) {
    [self finishWithStatus:@"无法创建共享容器。" openApp:NO];
    return;
  }

  dispatch_group_t group = dispatch_group_create();
  NSMutableArray<NSDictionary *> *entries = [NSMutableArray array];
  __block NSError *firstError = nil;
  NSString *createdAt = FFBShareISO8601String();

  for (NSExtensionItem *item in self.extensionContext.inputItems) {
    for (NSItemProvider *provider in item.attachments) {
      if ([self providerLooksLikeText:provider]) {
        dispatch_group_enter(group);
        [self loadTextEntryFromProvider:provider
                              createdAt:createdAt
                             completion:^(NSDictionary * _Nullable entry, NSError * _Nullable error) {
          if (entry != nil) {
            @synchronized(entries) {
              [entries addObject:entry];
            }
          } else if (error != nil && firstError == nil) {
            firstError = error;
          }

          dispatch_group_leave(group);
        }];
        continue;
      }

      NSString *typeIdentifier = [self preferredTypeIdentifierForProvider:provider];
      if (typeIdentifier.length == 0) {
        continue;
      }

      dispatch_group_enter(group);
      [provider loadFileRepresentationForTypeIdentifier:typeIdentifier
                                      completionHandler:^(NSURL * _Nullable url, NSError * _Nullable error) {
        if (error != nil || url == nil) {
          if (error != nil && firstError == nil) {
            firstError = error;
          }
          dispatch_group_leave(group);
          return;
        }

        NSError *copyError = nil;
        NSDictionary *entry = [self manifestEntryForProvider:provider
                                                   sourceURL:url
                                             typeIdentifier:typeIdentifier
                                                  shareRoot:shareRootURL
                                                  createdAt:createdAt
                                                      error:&copyError];
        if (entry != nil) {
          @synchronized(entries) {
            [entries addObject:entry];
          }
        } else if (copyError != nil && firstError == nil) {
          firstError = copyError;
        }

        dispatch_group_leave(group);
      }];
    }
  }

  dispatch_group_notify(group, dispatch_get_main_queue(), ^{
    if (firstError != nil) {
      [self finishWithStatus:firstError.localizedDescription ?: @"导入失败。" openApp:NO];
      return;
    }

    if (entries.count == 0) {
      [self finishWithStatus:@"没有检测到可导入的内容。" openApp:NO];
      return;
    }

    NSError *writeError = nil;
    if (![self writeManifestEntries:entries toShareRoot:shareRootURL error:&writeError]) {
      [self finishWithStatus:writeError.localizedDescription ?: @"无法保存共享内容。" openApp:NO];
      return;
    }

    [self finishWithStatus:@"已保存到 FileFlash Bridge。" openApp:YES];
  });
}

- (BOOL)providerLooksLikeText:(NSItemProvider *)provider
{
  if (@available(iOS 14.0, *)) {
    return
      [provider hasItemConformingToTypeIdentifier:UTTypePlainText.identifier] ||
      [provider hasItemConformingToTypeIdentifier:UTTypeURL.identifier];
  }

  return NO;
}

- (void)loadTextEntryFromProvider:(NSItemProvider *)provider
                        createdAt:(NSString *)createdAt
                       completion:(void (^)(NSDictionary *_Nullable entry, NSError *_Nullable error))completion
{
  NSString *typeIdentifier = nil;
  if (@available(iOS 14.0, *)) {
    if ([provider hasItemConformingToTypeIdentifier:UTTypeURL.identifier]) {
      typeIdentifier = UTTypeURL.identifier;
    } else if ([provider hasItemConformingToTypeIdentifier:UTTypePlainText.identifier]) {
      typeIdentifier = UTTypePlainText.identifier;
    }
  }

  if (typeIdentifier.length == 0) {
    completion(nil, nil);
    return;
  }

  [provider loadItemForTypeIdentifier:typeIdentifier
                              options:nil
                    completionHandler:^(id<NSSecureCoding>  _Nullable item, NSError * _Nullable error) {
    if (error != nil || item == nil) {
      completion(nil, error);
      return;
    }

    NSString *content = nil;
    if ([item isKindOfClass:[NSURL class]]) {
      content = ((NSURL *)item).absoluteString;
    } else if ([item isKindOfClass:[NSString class]]) {
      content = (NSString *)item;
    }

    content = [content stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
    if (content.length == 0) {
      completion(nil, nil);
      return;
    }

    completion(@{
      @"content": content,
      @"createdAt": createdAt,
      @"kind": @"text",
    }, nil);
  }];
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

- (NSDictionary *)manifestEntryForProvider:(NSItemProvider *)provider
                                 sourceURL:(NSURL *)sourceURL
                           typeIdentifier:(NSString *)typeIdentifier
                                shareRoot:(NSURL *)shareRootURL
                                createdAt:(NSString *)createdAt
                                    error:(NSError **)error
{
  NSString *fileName = [self preferredFileNameForProvider:provider sourceURL:sourceURL typeIdentifier:typeIdentifier];
  NSURL *destinationURL = [shareRootURL URLByAppendingPathComponent:fileName];
  NSFileManager *fileManager = [NSFileManager defaultManager];
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
    @"kind": @"file",
    @"mimeType": mimeType ?: [NSNull null],
    @"name": fileName,
    @"relativePath": fileName,
    @"sourcePath": destinationURL.path,
  };
}

- (NSString *)preferredFileNameForProvider:(NSItemProvider *)provider
                                 sourceURL:(NSURL *)sourceURL
                            typeIdentifier:(NSString *)typeIdentifier
{
  NSString *baseName = provider.suggestedName;
  if (baseName.length == 0) {
    baseName = sourceURL.lastPathComponent.stringByDeletingPathExtension;
  }
  baseName = FFBShareSanitizeFileName(baseName.length > 0 ? baseName : @"shared-item");

  NSString *extension = sourceURL.pathExtension;
  if (extension.length == 0 && @available(iOS 14.0, *)) {
    extension = [UTType typeWithIdentifier:typeIdentifier].preferredFilenameExtension;
  }

  return extension.length > 0 ? [NSString stringWithFormat:@"%@.%@", baseName, extension] : baseName;
}

- (NSURL *)nextShareDirectoryURL
{
  NSURL *containerURL = [[NSFileManager defaultManager]
    containerURLForSecurityApplicationGroupIdentifier:FFBShareExtensionGroup];
  if (containerURL == nil) {
    return nil;
  }

  NSURL *incomingRoot = [containerURL URLByAppendingPathComponent:@"IncomingShares" isDirectory:YES];
  NSURL *shareRoot = [incomingRoot URLByAppendingPathComponent:NSUUID.UUID.UUIDString isDirectory:YES];
  [[NSFileManager defaultManager] createDirectoryAtURL:shareRoot
                           withIntermediateDirectories:YES
                                            attributes:nil
                                                 error:nil];
  return shareRoot;
}

- (BOOL)writeManifestEntries:(NSArray<NSDictionary *> *)entries
                 toShareRoot:(NSURL *)shareRootURL
                       error:(NSError **)error
{
  NSData *data = [NSJSONSerialization dataWithJSONObject:entries options:0 error:error];
  if (data == nil) {
    return NO;
  }

  NSURL *manifestURL = [shareRootURL URLByAppendingPathComponent:@"manifest.json"];
  return [data writeToURL:manifestURL options:NSDataWritingAtomic error:error];
}

- (void)finishWithStatus:(NSString *)status openApp:(BOOL)openApp
{
  self.statusLabel.text = status;
  [self.spinner stopAnimating];

  void (^complete)(BOOL) = ^(BOOL didOpenApp) {
    (void)didOpenApp;
    [self.extensionContext completeRequestReturningItems:nil completionHandler:nil];
  };

  if (openApp && [self.extensionContext respondsToSelector:@selector(openURL:completionHandler:)]) {
    NSURL *url = [NSURL URLWithString:@"fileflashbridge://shared"];
    if (url != nil) {
      [self.extensionContext openURL:url completionHandler:complete];
      return;
    }
  }

  complete(NO);
}

@end
