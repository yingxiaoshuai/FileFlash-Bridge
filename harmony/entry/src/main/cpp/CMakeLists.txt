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
if(NOT DEFINED HARMONY_NATIVE_COMPILE_JOBS)
    set(HARMONY_NATIVE_COMPILE_JOBS 2)
endif()
if(NOT DEFINED HARMONY_NATIVE_LINK_JOBS)
    set(HARMONY_NATIVE_LINK_JOBS 1)
endif()
set_property(GLOBAL PROPERTY JOB_POOLS compile_pool=${HARMONY_NATIVE_COMPILE_JOBS} link_pool=${HARMONY_NATIVE_LINK_JOBS} rnoh_app_compile_pool=1)
set(CMAKE_JOB_POOL_COMPILE compile_pool)
set(CMAKE_JOB_POOL_LINK link_pool)
set(WITH_HITRACE_SYSTRACE ON)
set(WITH_HITRACE_REACT_MARKER ON)
set(OH_MODULES_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../../../oh_modules") # required by 'autolink_libraries'

add_subdirectory("${RNOH_CPP_DIR}" ./rn)
if(TARGET rnoh_core)
    # DevEco clang can crash while optimizing some RNOH core files.
    target_compile_options(rnoh_core PRIVATE -O0 -g0)
endif()
if(TARGET react_featureflags)
    # OHOS clang 15 can crash while emitting debug info for this RN target on Windows.
    target_compile_options(react_featureflags PRIVATE -O0 -g0)
endif()
if(TARGET react_nativemodule_featureflags)
    target_compile_options(react_nativemodule_featureflags PRIVATE -O0 -g0)
endif()
add_subdirectory("${OH_MODULES_DIR}/@react-native-oh-tpl/clipboard/src/main/cpp" ./clipboard)
add_subdirectory("${OH_MODULES_DIR}/@react-native-oh-tpl/netinfo/src/main/cpp" ./netinfo)
add_subdirectory("${OH_MODULES_DIR}/@react-native-oh-tpl/react-native-safe-area-context/src/main/cpp" ./safe_area)

include("${CMAKE_CURRENT_SOURCE_DIR}/autolinking.cmake")

file(GLOB GENERATED_CPP_FILES "${CMAKE_CURRENT_SOURCE_DIR}/generated/*.cpp") # this line is needed by codegen v1
add_library(rnoh_app SHARED
    ${GENERATED_CPP_FILES}
    "./FPFileAccess.cpp"
    "./FPStaticServer.cpp"
    "./PackageProvider.cpp"
    "${RNOH_CPP_DIR}/RNOHAppNapiBridge.cpp"
)
target_compile_options(rnoh_app PRIVATE -O0 -g0)
set_property(TARGET rnoh_app PROPERTY JOB_POOL_COMPILE rnoh_app_compile_pool)
target_link_libraries(rnoh_app PUBLIC rnoh)
target_link_libraries(rnoh_app PUBLIC rnoh_clipboard)
target_link_libraries(rnoh_app PUBLIC rnoh_netinfo)
target_link_libraries(rnoh_app PUBLIC rnoh_safe_area)

autolink_libraries(rnoh_app)
