#include "FPFileAccess.h"

namespace rnoh {

FPFileAccess::FPFileAccess(
    const ArkTSTurboModule::Context ctx,
    const std::string name)
    : ArkTSTurboModule(ctx, name) {
  methodMap_ = {
      ARK_ASYNC_METHOD_METADATA(copyFile, 2),
      ARK_ASYNC_METHOD_METADATA(readFile, 1),
      ARK_ASYNC_METHOD_METADATA(readFileChunk, 3),
      ARK_ASYNC_METHOD_METADATA(writeFile, 2),
      ARK_ASYNC_METHOD_METADATA(appendFile, 2),
      ARK_ASYNC_METHOD_METADATA(appendFileFromPath, 2),
      ARK_ASYNC_METHOD_METADATA(saveFileToDocuments, 2),
  };
}

} // namespace rnoh
