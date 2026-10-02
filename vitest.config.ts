import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // jsdom render-heavy interview specs run ~1-2s alone but contend with the
    // rest of the suite in CI; 5s default made them flake without any product bug.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // zod 3.25+ exposes a "@zod/source" export condition that points at the
      // raw TypeScript source (./src/index.ts). Vite's default condition
      // resolution picks that up and tries to transform .ts, which fails at
      // runtime with "undefined is not an object (evaluating 'z.object')".
      // Pin the alias to the pre-built JS bundle so tests import the same
      // compiled module the browser does.
      zod: path.resolve(__dirname, "./src/test/zod-shim.js"),
    },
  },
});
