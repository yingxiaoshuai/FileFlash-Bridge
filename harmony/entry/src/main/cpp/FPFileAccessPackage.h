#pragma once

#include "FPFileAccess.h"
#include "RNOH/Package.h"

namespace rnoh {

class FPFileAccessPackageTurboModuleFactoryDelegate
    : public TurboModuleFactoryDelegate {
 public:
  SharedTurboModule createTurboModule(
      Context ctx,
      const std::string &name) const override {
    if (name == "FPFileAccess") {
      return std::make_shared<FPFileAccess>(ctx, name);
    }
    return nullptr;
  }
};

class FPFileAccessPackage : public Package {
 public:
  FPFileAccessPackage(Package::Context ctx) : Package(ctx) {}

  std::unique_ptr<TurboModuleFactoryDelegate>
  createTurboModuleFactoryDelegate() override {
    return std::make_unique<FPFileAccessPackageTurboModuleFactoryDelegate>();
  }
};

} // namespace rnoh
