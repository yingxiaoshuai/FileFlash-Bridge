cmake_minimum_required(VERSION 3.13)

project(appmodules)

include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

# RN 0.82 promotes warnings to errors for new-architecture Android native builds,
# while react-native-svg 15.0.0 still includes the deprecated SharedImageManager
# Fabric type in its headers. Suppress only this warning class in app space so we
# don't need to patch third-party sources under node_modules.
set(FILEFLASH_DEPRECATION_WARNING_FLAGS
    -Wno-deprecated-declarations
    -Wno-error=deprecated-declarations
)

target_compile_options(${CMAKE_PROJECT_NAME}
    PRIVATE
    ${FILEFLASH_DEPRECATION_WARNING_FLAGS}
)

if(TARGET common_flags)
    target_compile_options(common_flags
        INTERFACE
        ${FILEFLASH_DEPRECATION_WARNING_FLAGS}
    )
endif()

if(DEFINED APP_CODEGEN_TARGET AND TARGET ${APP_CODEGEN_TARGET})
    target_compile_options(${APP_CODEGEN_TARGET}
        PRIVATE
        ${FILEFLASH_DEPRECATION_WARNING_FLAGS}
    )
endif()

if(DEFINED AUTOLINKED_LIBRARIES)
    foreach(autolinked_library ${AUTOLINKED_LIBRARIES})
        if(TARGET ${autolinked_library})
            target_compile_options(${autolinked_library}
                PRIVATE
                ${FILEFLASH_DEPRECATION_WARNING_FLAGS}
            )
        endif()
    endforeach()
endif()
