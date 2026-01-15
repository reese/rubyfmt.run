# rubyfmt.run

A web-based Ruby code formatter playground that runs [rubyfmt](https://github.com/fables-tales/rubyfmt) via WebAssembly in the browser.

## Prerequisites

- [Rust](https://rustup.rs/)
- [Node.js](https://nodejs.org/) (v18+)
- Git (for cloning Emscripten SDK)

The build script will automatically install:

- Emscripten SDK (into `./emsdk/`)
- Rust `wasm32-unknown-emscripten` target

## Building

Run the full build (WASM + web assets):

```bash
./build.sh
```

This will:

1. Build the Rust library for the Emscripten target
2. Link with Emscripten to produce WASM + JS loader
3. Install npm dependencies
4. Bundle the web assets with Vite

The built site will be in `web/dist/`.

## Development

After running `./build.sh` at least once (to build WASM):

```bash
cd web
npm run dev
```

This starts a dev server with hot reload at http://localhost:5173.

If you change the Rust code, rebuild with:

```bash
cargo build --target wasm32-unknown-emscripten --release
emcc target/wasm32-unknown-emscripten/release/librubyfmt_wasm.a \
    -o web/wasm/rubyfmt.js \
    -s WASM=1 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME="createRubyfmtModule" \
    -s EXPORTED_FUNCTIONS='["_format", "_free_string", "_malloc", "_free"]' \
    -s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "UTF8ToString", "stringToUTF8", "lengthBytesUTF8"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s ENVIRONMENT='web' \
    -O3
```

## Deployment

Serve the `web/dist/` directory with any static file server. The site is fully static with no backend required.
