import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Builds ONLY the React landing page into solar-system/landing-dist/ as a
// plain <script type="module"> + stylesheet with fixed filenames (no content
// hash) — solar-system/index.html references them directly by path. The rest
// of the app (solar-system/src/**) stays exactly what it already was: plain
// ES modules loaded via importmap, no build step, no bundler touching them.
// This is the ONE build step in an otherwise buildless static site — see
// netlify.toml's `command` and the project README's "Running locally"
// section for how that fits into the deploy/dev workflow.
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  build: {
    outDir: "solar-system/landing-dist",
    emptyOutDir: true,
    rollupOptions: {
      input: "solar-system/landing-src/main.jsx",
      output: {
        entryFileNames: "landing.js",
        chunkFileNames: "landing-[name].js",
        assetFileNames: (info) => (info.name && info.name.endsWith(".css") ? "landing.css" : "landing-[name][extname]"),
        format: "es",
      },
    },
  },
});
