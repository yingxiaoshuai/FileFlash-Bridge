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
  return dispatch_queue_create("com.fileflashbridge.filereader", DISPATCH_QUEUE_CONCURRENT);
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

RCT_EXPORT_METHOD(appendFileFromPath:(NSString *)destinationPath
                  sourcePath:(NSString *)sourcePath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  if (destinationPath == nil || destinationPath.length == 0) {
    reject(@"EINVAL", @"EINVAL: destination path is required", nil);
    return;
  }

  if (sourcePath == nil || sourcePath.length == 0) {
    reject(@"EINVAL", @"EINVAL: source path is required", nil);
    return;
  }

  NSFileManager *fileManager = [NSFileManager defaultManager];
  NSString *destinationDir = [destinationPath stringByDeletingLastPathComponent];
  if (destinationDir.length > 0) {
    NSError *dirError = nil;
    if (![fileManager createDirectoryAtPath:destinationDir
                withIntermediateDirectories:YES
                                 attributes:nil
                                      error:&dirError]) {
      reject(@"EUNSPECIFIED", dirError.localizedDescription ?: @"Unable to create destination directory", dirError);
      return;
    }
  }

  if (![fileManager fileExistsAtPath:destinationPath]) {
    [fileManager createFileAtPath:destinationPath contents:nil attributes:nil];
  }

  NSFileHandle *sourceHandle = [NSFileHandle fileHandleForReadingAtPath:sourcePath];
  if (sourceHandle == nil) {
    reject(@"ENOENT", [NSString stringWithFormat:@"ENOENT: could not open source file '%@'", sourcePath], nil);
    return;
  }

  NSFileHandle *destinationHandle = [NSFileHandle fileHandleForWritingAtPath:destinationPath];
  if (destinationHandle == nil) {
    [sourceHandle closeFile];
    reject(@"ENOENT", [NSString stringWithFormat:@"ENOENT: could not open destination file '%@'", destinationPath], nil);
    return;
  }

  @try {
    [destinationHandle seekToEndOfFile];
    while (YES) {
      @autoreleasepool {
        NSData *chunk = [sourceHandle readDataOfLength:256 * 1024];
        if (chunk.length == 0) {
          break;
        }
        [destinationHandle writeData:chunk];
      }
    }
    [sourceHandle closeFile];
    [destinationHandle closeFile];
    resolve(nil);
  }
  @catch (NSException *exception) {
    @try {
      [sourceHandle closeFile];
      [destinationHandle closeFile];
    }
    @catch (__unused NSException *closeException) {
    }

    reject(
      @"EUNSPECIFIED",
      [NSString stringWithFormat:@"EUNSPECIFIED: error appending file '%@' to '%@': %@", sourcePath, destinationPath, exception.reason ?: @"Unknown error"],
      nil
    );
  }
}

RCT_EXPORT_METHOD(writeFileFromPathAtOffset:(NSString *)destinationPath
                  sourcePath:(NSString *)sourcePath
                  offset:(nonnull NSNumber *)offset
                  length:(nonnull NSNumber *)length
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  if (destinationPath == nil || destinationPath.length == 0) {
    reject(@"EINVAL", @"EINVAL: destination path is required", nil);
    return;
  }

  if (sourcePath == nil || sourcePath.length == 0) {
    reject(@"EINVAL", @"EINVAL: source path is required", nil);
    return;
  }

  if (offset.doubleValue < 0 || length.doubleValue < 0) {
    reject(@"EINVAL", @"EINVAL: offset and length must be non-negative", nil);
    return;
  }

  unsigned long long requestedLength = length.unsignedLongLongValue;
  if (requestedLength == 0) {
    resolve(nil);
    return;
  }

  NSFileManager *fileManager = [NSFileManager defaultManager];
  NSString *destinationDir = [destinationPath stringByDeletingLastPathComponent];
  if (destinationDir.length > 0) {
    NSError *dirError = nil;
    if (![fileManager createDirectoryAtPath:destinationDir
                withIntermediateDirectories:YES
                                 attributes:nil
                                      error:&dirError]) {
      reject(@"EUNSPECIFIED", dirError.localizedDescription ?: @"Unable to create destination directory", dirError);
      return;
    }
  }

  if (![fileManager fileExistsAtPath:destinationPath]) {
    if (![fileManager createFileAtPath:destinationPath contents:nil attributes:nil] &&
        ![fileManager fileExistsAtPath:destinationPath]) {
      reject(@"EUNSPECIFIED", [NSString stringWithFormat:@"Unable to create destination file '%@'", destinationPath], nil);
      return;
    }
  }

  NSFileHandle *sourceHandle = [NSFileHandle fileHandleForReadingAtPath:sourcePath];
  if (sourceHandle == nil) {
    reject(@"ENOENT", [NSString stringWithFormat:@"ENOENT: could not open source file '%@'", sourcePath], nil);
    return;
  }

  NSFileHandle *destinationHandle = [NSFileHandle fileHandleForWritingAtPath:destinationPath];
  if (destinationHandle == nil) {
    [sourceHandle closeFile];
    reject(@"ENOENT", [NSString stringWithFormat:@"ENOENT: could not open destination file '%@'", destinationPath], nil);
    return;
  }

  @try {
    unsigned long long remaining = requestedLength;
    [sourceHandle seekToFileOffset:0];
    [destinationHandle seekToFileOffset:offset.unsignedLongLongValue];
    while (remaining > 0) {
      @autoreleasepool {
        NSUInteger readLength = (NSUInteger)MIN(remaining, 256 * 1024);
        NSData *chunk = [sourceHandle readDataOfLength:readLength];
        if (chunk.length == 0) {
          break;
        }

        [destinationHandle writeData:chunk];
        remaining -= chunk.length;
      }
    }

    [sourceHandle closeFile];
    [destinationHandle closeFile];

    if (remaining > 0) {
      reject(
        @"EUNSPECIFIED",
        [NSString stringWithFormat:@"EUNSPECIFIED: source file '%@' ended before %@ bytes could be written", sourcePath, length],
        nil
      );
      return;
    }

    resolve(nil);
  }
  @catch (NSException *exception) {
    @try {
      [sourceHandle closeFile];
      [destinationHandle closeFile];
    }
    @catch (__unused NSException *closeException) {
    }

    reject(
      @"EUNSPECIFIED",
      [NSString stringWithFormat:@"EUNSPECIFIED: error writing file '%@' to '%@': %@", sourcePath, destinationPath, exception.reason ?: @"Unknown error"],
      nil
    );
  }
}

@end
