import { defineConfig, type Plugin } from "vite";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const buildId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function versionPlugin(): Plugin {
  return {
    name: "music-z-version",
    closeBundle() {
      const dir = resolve(process.cwd(), "dist");
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        resolve(dir, "version.json"),
        JSON.stringify({ buildId, builtAt: new Date().toISOString() }),
      );
    },
  };
}

export default defineConfig({
  base: "/Music_Z/",
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: "es2022",
    sourcemap: false,
    cssCodeSplit: false,
    cssMinify: true,
  },
  plugins: [versionPlugin()],
});
