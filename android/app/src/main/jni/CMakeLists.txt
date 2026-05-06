cmake_minimum_required(VERSION 3.13)

project(appmodules)

include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

function(fileflash_inherit_interface_includes target_name dependency_name)
    if(TARGET ${target_name} AND TARGET ${dependency_name})
        target_include_directories(${target_name}
            PRIVATE
            $<TARGET_PROPERTY:${dependency_name},INTERFACE_INCLUDE_DIRECTORIES>
        )
    endif()
endfunction()

function(fileflash_replace_compile_option target_name old_option new_option)
    if(TARGET ${target_name})
        get_target_property(fileflash_compile_options ${target_name} COMPILE_OPTIONS)

        if(fileflash_compile_options AND NOT fileflash_compile_options STREQUAL "fileflash_compile_options-NOTFOUND")
            set(fileflash_filtered_compile_options ${fileflash_compile_options})
            list(REMOVE_ITEM fileflash_filtered_compile_options ${old_option})
            set_property(
                TARGET ${target_name}
                PROPERTY COMPILE_OPTIONS "${fileflash_filtered_compile_options}"
            )
        endif()

        target_compile_options(${target_name}
            PRIVATE
            ${new_option}
        )
    endif()
endfunction()

function(fileflash_remove_link_libraries target_name)
    if(TARGET ${target_name})
        get_target_property(fileflash_link_libraries ${target_name} LINK_LIBRARIES)

        if(fileflash_link_libraries AND NOT fileflash_link_libraries STREQUAL "fileflash_link_libraries-NOTFOUND")
            set(fileflash_filtered_link_libraries ${fileflash_link_libraries})

            foreach(fileflash_link_library ${ARGN})
                list(REMOVE_ITEM fileflash_filtered_link_libraries ${fileflash_link_library})
            endforeach()

            set_property(
                TARGET ${target_name}
                PROPERTY LINK_LIBRARIES "${fileflash_filtered_link_libraries}"
            )
        endif()
    endif()
endfunction()

function(fileflash_set_link_libraries target_name)
    if(TARGET ${target_name})
        set_property(
            TARGET ${target_name}
            PROPERTY LINK_LIBRARIES "${ARGN}"
        )
        set_property(
            TARGET ${target_name}
            PROPERTY INTERFACE_LINK_LIBRARIES "${ARGN}"
        )
    endif()
endfunction()

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

if(TARGET react_codegen_rnsvg)
    # react-native-svg 15.0.0 still uses the pre-RN-0.76 CMake layout and does
    # not inherit the merged reactnative target's public headers on Android.
    # RN 0.82 moves files like LayoutContext.h / ImageRequest.h behind that
    # interface, so we patch the include inheritance here in app space.
    set(FILEFLASH_RNSVG_INTERFACE_TARGETS
        reactnative
        ReactAndroid::reactnative
        react_codegen_rncore
        react_debug
        react_nativemodule_core
        react_render_core
        react_render_debug
        react_render_graphics
        react_render_imagemanager
        react_render_mapbuffer
        react_utils
        rrc_image
        rrc_view
        turbomodulejsijni
        yoga
    )

    foreach(fileflash_rnsvg_dependency ${FILEFLASH_RNSVG_INTERFACE_TARGETS})
        fileflash_inherit_interface_includes(
            react_codegen_rnsvg
            ${fileflash_rnsvg_dependency}
        )
    endforeach()

    # The bundled rnsvg CMake target appends -std=c++17, but RN 0.82 headers
    # now use C++20 concepts / std::identity / std::bit_width. Append c++20
    # again here so the final compile command matches the React Native toolchain.
    fileflash_replace_compile_option(
        react_codegen_rnsvg
        -std=c++17
        -std=c++20
    )

    if(REACTNATIVE_MERGED_SO)
        if(TARGET reactnative)
            set(fileflash_rnsvg_link_targets
                fbjni
                jsi
                reactnative
            )

            if(TARGET common_flags)
                list(APPEND fileflash_rnsvg_link_targets common_flags)
            endif()

            fileflash_set_link_libraries(
                react_codegen_rnsvg
                ${fileflash_rnsvg_link_targets}
            )
        endif()
    endif()
endif()
