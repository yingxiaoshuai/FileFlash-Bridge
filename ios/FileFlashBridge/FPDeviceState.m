#import <React/RCTBridgeModule.h>
#import <UIKit/UIKit.h>

@interface FPDeviceState : NSObject <RCTBridgeModule>
@end

@implementation FPDeviceState

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

RCT_EXPORT_METHOD(setIdleTimerDisabled:(BOOL)disabled)
{
  UIApplication.sharedApplication.idleTimerDisabled = disabled;
}

@end
