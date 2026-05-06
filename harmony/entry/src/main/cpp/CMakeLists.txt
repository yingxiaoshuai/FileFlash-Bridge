cmake_minimum_required(VERSION 3.11)
project(rnapp)

# HarmonyOS arm64 exposes pthread APIs through the system runtime rather than
# a separate libpthread/libpthreads artifact. Force CMake's thread detection
# to treat pthread support as built-in so nested third-party CMake logic does
# not fail during configure.
set(THREADS_PREFER_PTHREAD_FLAG TRUE)
set(CMAKE_THREAD_LIBS_INIT "" CACHE STRING "" FORCE)
set(CMAKE_HAVE_THREADS_LIBRARY 1 CACHE INTERNAL "" FORCE)
set(CMAKE_HAVE_LIBC_PTHREAD TRUE CACHE INTERNAL "" FORCE)
set(CMAKE_USE_PTHREADS_INIT 1 CACHE INTERNAL "" FORCE)
set(CMAKE_USE_WIN32_THREADS_INIT 0 CACHE INTERNAL "" FORCE)
set(CMAKE_HP_PTHREADS_INIT 0 CACHE INTERNAL "" FORCE)
set(Threads_FOUND TRUE CACHE INTERNAL "" FORCE)

set(RNOH_APP_DIR "${CMAKE_CURRENT_SOURCE_DIR}")
set(NODE_MODULES "${CMAKE_CURRENT_SOURCE_DIR}/../../../../../node_modules")
set(RNOH_CPP_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../../../oh_modules/@rnoh/react-native-openharmony/src/main/cpp")
set(RNOH_GENERATED_DIR "${CMAKE_CURRENT_SOURCE_DIR}/generated")
set(LOG_VERBOSITY_LEVEL 1)
set(CMAKE_ASM_FLAGS "-Wno-error=unused-command-line-argument -Qunused-arguments")
set(CMAKE_CXX_FLAGS "-fstack-protector-strong -Wl,-z,relro,-z,now,-z,noexecstack -s -fPIE -pie")
set(WITH_HITRACE_SYSTRACE ON)
set(WITH_HITRACE_REACT_MARKER ON)
set(OH_MODULES_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../../../oh_modules") # required by 'autolink_libraries'

add_subdirectory("${RNOH_CPP_DIR}" ./rn)
add_subdirectory("${OH_MODULES_DIR}/@react-native-oh-tpl/clipboard/src/main/cpp" ./clipboard)
add_subdirectory("${OH_MODULES_DIR}/@react-native-oh-tpl/netinfo/src/main/cpp" ./netinfo)
add_subdirectory("${OH_MODULES_DIR}/@react-native-oh-tpl/react-native-safe-area-context/src/main/cpp" ./safe_area)
add_subdirectory("${OH_MODULES_DIR}/@react-native-oh-tpl/react-native-svg/src/main/cpp" ./svg)

include("${CMAKE_CURRENT_SOURCE_DIR}/autolinking.cmake")

file(GLOB GENERATED_CPP_FILES "${CMAKE_CURRENT_SOURCE_DIR}/generated/*.cpp") # this line is needed by codegen v1
add_library(rnoh_app SHARED
    ${GENERATED_CPP_FILES}
    "./PackageProvider.cpp"
    "${RNOH_CPP_DIR}/RNOHAppNapiBridge.cpp"
)
target_link_libraries(rnoh_app PUBLIC rnoh)
target_link_libraries(rnoh_app PUBLIC rnoh_clipboard)
target_link_libraries(rnoh_app PUBLIC rnoh_netinfo)
target_link_libraries(rnoh_app PUBLIC rnoh_safe_area)
target_link_libraries(rnoh_app PUBLIC rnoh_svg)

autolink_libraries(rnoh_app)
