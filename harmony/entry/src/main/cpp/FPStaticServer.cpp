#include "FPStaticServer.h"

namespace rnoh {

FPStaticServer::FPStaticServer(
    const ArkTSTurboModule::Context ctx,
    const std::string name)
    : ArkTSTurboModule(ctx, name) {
  methodMap_ = {
      ARK_ASYNC_METHOD_METADATA(start, 4),
      ARK_ASYNC_METHOD_METADATA(stop, 0),
      ARK_ASYNC_METHOD_METADATA(origin, 0),
      ARK_ASYNC_METHOD_METADATA(isRunning, 0),
      ARK_METHOD_METADATA(respond, 5),
      ARK_METHOD_METADATA(respondBytes, 4),
      ARK_METHOD_METADATA(respondFile, 6),
      ARK_METHOD_METADATA(addListener, 1),
      ARK_METHOD_METADATA(removeListeners, 1),
  };
}

} // namespace rnoh
