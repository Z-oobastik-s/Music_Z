import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages project site: https://z-oobastik-s.github.io/Music_Z/
  base: "/Music_Z/",
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
