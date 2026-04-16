require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name = "FileFlashStaticServer"
  s.version = package["version"]
  s.summary = package["description"]
  s.homepage = package["homepage"]
  s.license = package["license"]
  s.author = { package["author"]["name"] => package["author"]["email"] }
  s.platform = :ios, "11.0"
  s.source = { :git => "https://github.com/fileflash-bridge/fileflash-bridge.git", :tag => "v#{s.version}" }
  s.requires_arc = true

  s.source_files = "ios/*.{h,m}"

  if defined?(install_modules_dependencies)
    install_modules_dependencies(s)
  else
    s.dependency "React-Core"
  end

  s.dependency "GCDWebServer", "~> 3.0"
end
