import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { readdirSync, rmSync, statSync } from "node:fs";

// Source maps are uploaded to Sentry (so production stack traces are readable)
// and then deleted from the build, so the maps themselves are never served.
// Uploading is opt-in: without SENTRY_AUTH_TOKEN the build is untouched.
const sentryUpload = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT,
);

/**
 * Safety net: when no upload happened, the generated .map files still exist in
 * dist. Publishing them would hand the full source tree to anyone who guesses a
 * filename, so they are removed after the bundle is written.
 */
function dropSourcemaps(outDir: string) {
  return {
    name: "gradr-drop-sourcemaps",
    apply: "build" as const,
    closeBundle() {
      const walk = (dir: string) => {
        for (const entry of readdirSync(dir)) {
          const full = path.join(dir, entry);
          if (statSync(full).isDirectory()) walk(full);
          else if (full.endsWith(".map")) rmSync(full);
        }
      };
      try {
        walk(outDir);
      } catch {
        /* nothing built — nothing to clean */
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mcpPlugin(),
    sentryUpload &&
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        release: { name: process.env.VITE_APP_RELEASE },
        sourcemaps: {
          // Upload, then remove: hashed .map files must not ship to the CDN.
          filesToDeleteAfterUpload: ["dist/**/*.js.map"],
        },
        telemetry: false,
      }),
    dropSourcemaps(path.resolve(__dirname, "dist")),
  ].filter(Boolean),
  build: {
    // "hidden" emits maps without a sourceMappingURL comment: Sentry can
    // symbolicate a production stack trace, browsers never fetch the map.
    sourcemap: mode === "production" ? "hidden" : false,
    // NOTE: do NOT hand-roll manualChunks here. Manually splitting interdependent
    // vendor packages (react / router / motion / charts) produced cross-chunk
    // circular imports and a "Cannot access 'X' before initialization" TDZ crash
    // in production. Rollup's default chunking + route-level React.lazy already
    // keep the entry payload small.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Opaque, content-hashed filenames. Default Rollup naming leaks the
        // dependency graph to anyone reading the HTML (`react-dom-*.js`,
        // `motion-*.js`, route/component names), which is the only stack
        // fingerprint we actually control. Names are cosmetic — this changes
        // no chunk boundaries, so it cannot reintroduce the TDZ crash above.
        entryFileNames: 'assets/[hash].js',
        chunkFileNames: 'assets/[hash].js',
        assetFileNames: 'assets/[hash][extname]',
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
