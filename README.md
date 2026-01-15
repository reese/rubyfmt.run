# [rubyfmt.run](https://rubyfmt.run)

A web-based playground that runs [rubyfmt](https://github.com/fables-tales/rubyfmt) via WebAssembly in the browser.

## Prerequisites

- Rust
- Node.js (v18+)
- Git (for cloning the Emscripten SDK)

The build script will automatically install:

- Emscripten SDK
- Rust `wasm32-unknown-emscripten` target

## Building

Run the full build (WASM + web assets):

```bash
./build.sh
```

The built site will be in `web/dist/`.

## Development

After running `./build.sh` at least once:

```bash
cd web
npm run dev
```

This starts a dev server with hot reload at http://localhost:5173.

If you change the Rust code, rebuild with `./build.sh`

## Deployment

Serve the `web/dist/` directory with any static file server. The site is fully static with no backend required.
