import { defineConfig } from "vite";

export default defineConfig({
  build: { outDir: "dist", emptyOutDir: true },
  server: { port: 5191, proxy: { "/api": "http://localhost:8787" } },
});
