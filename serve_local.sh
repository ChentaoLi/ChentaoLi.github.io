#!/bin/bash
# Local preview server for this Jekyll site (Windows, no MSYS2 devkit needed).
#
# Why this file exists:
#   The machine's RubyInstaller devkit did not install the MinGW64 gcc, and
#   pacman/keyring setup is broken in this sandbox. We instead use a standalone
#   MinGW-w64 UCRT toolchain (winlibs) at C:/mingw64/mingw64/bin plus a local
#   Gemfile.local (plain jekyll + plugins, no github-pages meta-gem) so native
#   gems compile and the site previews faithfully.
#
# Usage (run from the repo root, in Git Bash):
#   ./serve_local.sh
# Then open http://127.0.0.1:4000
#
set -e
export PATH="/c/mingw64/mingw64/bin:/c/Ruby33/msys64/usr/bin:/c/Ruby33/bin:$PATH"
export C_INCLUDE_PATH="C:/Ruby33/include/ruby-3.3.0;C:/Ruby33/include/ruby-3.3.0/x64-mingw-ucrt"
export CPLUS_INCLUDE_PATH="$C_INCLUDE_PATH"
export LIBRARY_PATH="C:/Ruby33/lib"
cd "$(dirname "$0")"
BUNDLE_GEMFILE=Gemfile.local bundle exec jekyll serve --host 127.0.0.1 --port 4000 --livereload
