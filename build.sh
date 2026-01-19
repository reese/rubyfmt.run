#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EMSDK_DIR="$SCRIPT_DIR/emsdk"

# Install/setup Emscripten if needed
if [ ! -d "$EMSDK_DIR" ]; then
    echo "Installing Emscripten SDK..."
    git clone https://github.com/emscripten-core/emsdk.git "$EMSDK_DIR"
    cd "$EMSDK_DIR"
    ./emsdk install latest
    ./emsdk activate latest
    cd "$SCRIPT_DIR"
fi

# Source Emscripten environment
source "$EMSDK_DIR/emsdk_env.sh"

# Check for Rust emscripten target
if ! rustup target list --installed | grep -q "wasm32-unknown-emscripten"; then
    echo "Installing wasm32-unknown-emscripten target..."
    rustup target add wasm32-unknown-emscripten
fi

# Set up cross-compilation environment for Emscripten
# The cc crate and bindgen need to know where to find headers
EMSCRIPTEN_SYSROOT="$EMSDK_DIR/upstream/emscripten/cache/sysroot"

export CC_wasm32_unknown_emscripten="emcc"
export AR_wasm32_unknown_emscripten="emar"
export CFLAGS_wasm32_unknown_emscripten="--sysroot=$EMSCRIPTEN_SYSROOT"

# Bindgen needs clang args to find Emscripten headers
export BINDGEN_EXTRA_CLANG_ARGS_wasm32_unknown_emscripten="--sysroot=$EMSCRIPTEN_SYSROOT -fvisibility=default"

echo "Building Rust library for Emscripten..."
env "BINDGEN_EXTRA_CLANG_ARGS_wasm32-unknown-emscripten=--sysroot=$EMSCRIPTEN_SYSROOT -fvisibility=default" \
    cargo build --target wasm32-unknown-emscripten --release

echo "Linking with Emscripten..."
mkdir -p web/wasm

emcc \
    target/wasm32-unknown-emscripten/release/librubyfmt_wasm.a \
    -o web/wasm/rubyfmt.js \
    -s WASM=1 \
    -s MODULARIZE=1 \
    -s EXPORT_ES6=1 \
    -s EXPORT_NAME="createRubyfmtModule" \
    -s EXPORTED_FUNCTIONS='["_format", "_free_string", "_malloc", "_free"]' \
    -s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "UTF8ToString", "stringToUTF8", "lengthBytesUTF8"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s ENVIRONMENT='web' \
    -Oz

echo "Optimizing WASM binary with wasm-opt..."
# Use wasm-opt from Emscripten SDK
"$EMSDK_DIR/upstream/bin/wasm-opt" -Oz --all-features --strip-debug -o web/wasm/rubyfmt_opt.wasm web/wasm/rubyfmt.wasm
mv web/wasm/rubyfmt_opt.wasm web/wasm/rubyfmt.wasm

echo "Extracting rubyfmt version info..."
RUBYFMT_VERSION=$(grep -A2 'name = "rubyfmt"' Cargo.lock | grep 'version' | sed 's/.*"\(.*\)"/\1/')
RUBYFMT_COMMIT=$(grep -A2 'name = "rubyfmt"' Cargo.lock | grep 'source' | sed 's/.*#\([a-f0-9]*\)"/\1/')
RUBYFMT_SHORT_COMMIT=${RUBYFMT_COMMIT:0:7}
echo "{\"version\": \"$RUBYFMT_VERSION\", \"commit\": \"$RUBYFMT_COMMIT\", \"shortCommit\": \"$RUBYFMT_SHORT_COMMIT\"}" > web/version.json
echo "rubyfmt version: $RUBYFMT_VERSION @ $RUBYFMT_SHORT_COMMIT"

echo "Installing web dependencies..."
cd web
npm install

echo "Building web assets..."
npm run build

echo "Build complete. Serve the 'web/dist' directory."
