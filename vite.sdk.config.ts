import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist-sdk",
    copyPublicDir: false,
    lib: {
      entry: "src/sdk/index.ts",
      formats: ["es"],
      fileName: () => "index.js",
    },
    sourcemap: true,
  },
});
