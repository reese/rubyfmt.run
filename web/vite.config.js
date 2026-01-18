import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  build: {
    outDir: "dist",
    rollupOptions: {
      input: "index.html",
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: "wasm/rubyfmt.wasm",
          dest: "wasm",
        },
        {
          src: "static/*",
          dest: "static",
        },
        {
          src: "version.json",
          dest: ".",
        },
      ],
    }),
  ],
  optimizeDeps: {
    exclude: ["./wasm/rubyfmt.js"],
  },
});
