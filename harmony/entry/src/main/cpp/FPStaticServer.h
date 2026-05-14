#pragma once

#include "RNOH/ArkTSTurboModule.h"

namespace rnoh {

class JSI_EXPORT FPStaticServer : public ArkTSTurboModule {
 public:
  FPStaticServer(const ArkTSTurboModule::Context ctx, const std::string name);
};

} // namespace rnoh
