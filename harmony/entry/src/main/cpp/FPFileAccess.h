#pragma once

#include "RNOH/ArkTSTurboModule.h"

namespace rnoh {

class JSI_EXPORT FPFileAccess : public ArkTSTurboModule {
 public:
  FPFileAccess(const ArkTSTurboModule::Context ctx, const std::string name);
};

} // namespace rnoh
