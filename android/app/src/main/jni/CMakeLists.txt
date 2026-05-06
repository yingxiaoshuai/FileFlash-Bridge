cmake_minimum_required(VERSION 3.13)

project(appmodules)

include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

# RN 0.82 promotes some deprecated-declarations warnings to errors in Android
# native builds. Relax only that warning class in project space so autolinked
# third-party code can build without patching every dependency individually.
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
