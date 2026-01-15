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
      ],
    }),
  ],
  optimizeDeps: {
    exclude: ["./wasm/rubyfmt.js"],
  },
});
