cmake_minimum_required(VERSION 3.16)
project(baws_core VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ── Build Options ──────────────────────────────────────────────────
option(BAWS_BUILD_TESTS "Build test executable" OFF)
option(BAWS_ENABLE_OPENMP "Enable OpenMP for parallel bootstrap" OFF)

# ── Shared Library (for FFI: Node.js koffi, Python ctypes) ────────
add_library(baws_core SHARED
    baws_engine.cpp
)

target_compile_definitions(baws_core PRIVATE BAWS_EXPORTS)

# Platform-specific settings
if(MSVC)
    target_compile_options(baws_core PRIVATE /O2 /W4)
else()
    target_compile_options(baws_core PRIVATE -O3 -Wall -Wextra -fPIC)
    # Visibility for Linux/macOS shared library
    set_target_properties(baws_core PROPERTIES
        CXX_VISIBILITY_PRESET hidden
    )
endif()

# OpenMP (optional — parallelizes bootstrap iterations)
if(BAWS_ENABLE_OPENMP)
    find_package(OpenMP)
    if(OpenMP_CXX_FOUND)
        target_link_libraries(baws_core PRIVATE OpenMP::OpenMP_CXX)
        message(STATUS "OpenMP enabled for parallel bootstrap")
    else()
        message(WARNING "OpenMP requested but not found")
    endif()
endif()

# ── Install Rules ──────────────────────────────────────────────────
install(TARGETS baws_core
    LIBRARY DESTINATION lib
    RUNTIME DESTINATION bin    # Windows DLLs go to bin
    ARCHIVE DESTINATION lib
)

install(FILES baws_engine.h DESTINATION include)

# ── Test Executable (optional) ─────────────────────────────────────
if(BAWS_BUILD_TESTS)
    add_executable(baws_test
        baws_engine.cpp
    )
    target_compile_definitions(baws_test PRIVATE BAWS_EXPORTS)
    # Add a main() for testing
    target_compile_definitions(baws_test PRIVATE BAWS_BUILD_MAIN)
endif()
