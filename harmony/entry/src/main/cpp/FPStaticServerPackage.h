#pragma once

#include "FPStaticServer.h"
#include "RNOH/Package.h"

namespace rnoh {

class FPStaticServerPackageTurboModuleFactoryDelegate
    : public TurboModuleFactoryDelegate {
 public:
  SharedTurboModule createTurboModule(
      Context ctx,
      const std::string &name) const override {
    if (name == "FPStaticServer") {
      return std::make_shared<FPStaticServer>(ctx, name);
    }
    return nullptr;
  }
};

class FPStaticServerPackage : public Package {
 public:
  FPStaticServerPackage(Package::Context ctx) : Package(ctx) {}

  std::unique_ptr<TurboModuleFactoryDelegate>
  createTurboModuleFactoryDelegate() override {
    return std::make_unique<FPStaticServerPackageTurboModuleFactoryDelegate>();
  }
};

} // namespace rnoh
