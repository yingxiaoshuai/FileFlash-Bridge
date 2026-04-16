#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>

@interface FPFileReader : NSObject <RCTBridgeModule>
@end

@implementation FPFileReader

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_queue_create("com.fileflashbridge.filereader", DISPATCH_QUEUE_SERIAL);
}

RCT_EXPORT_METHOD(readChunkBase64:(NSString *)filepath
                  offset:(nonnull NSNumber *)offset
                  length:(nonnull NSNumber *)length
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  if (filepath == nil || filepath.length == 0) {
    reject(@"EINVAL", @"EINVAL: file path is required", nil);
    return;
  }

  NSUInteger requestedLength = length.unsignedIntegerValue;
  if (requestedLength == 0) {
    resolve(@"");
    return;
  }

  NSFileManager *fileManager = [NSFileManager defaultManager];
  BOOL isDirectory = NO;
  BOOL fileExists = [fileManager fileExistsAtPath:filepath isDirectory:&isDirectory];
  if (!fileExists) {
    reject(@"ENOENT", [NSString stringWithFormat:@"ENOENT: no such file or directory, open '%@'", filepath], nil);
    return;
  }

  if (isDirectory) {
    reject(@"EISDIR", @"EISDIR: illegal operation on a directory, read", nil);
    return;
  }

  NSFileHandle *fileHandle = [NSFileHandle fileHandleForReadingAtPath:filepath];
  if (fileHandle == nil) {
    reject(@"ENOENT", [NSString stringWithFormat:@"ENOENT: could not open file '%@' for reading", filepath], nil);
    return;
  }

  @try {
    [fileHandle seekToFileOffset:offset.unsignedLongLongValue];
    NSData *content = [fileHandle readDataOfLength:requestedLength];
    [fileHandle closeFile];
    resolve([content base64EncodedStringWithOptions:0] ?: @"");
  }
  @catch (NSException *exception) {
    @try {
      [fileHandle closeFile];
    }
    @catch (__unused NSException *closeException) {
    }

    reject(
      @"EUNSPECIFIED",
      [NSString stringWithFormat:@"EUNSPECIFIED: error reading file '%@': %@", filepath, exception.reason ?: @"Unknown error"],
      nil
    );
  }
}

@end
