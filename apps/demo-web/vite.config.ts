import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Hardcoded Stripe publishable key, baked into the build at compile time.
// This is a *publishable* key (safe for the browser); the secret key lives
// only in the Go backend. Hardcoding here means the build does not depend
// on apps/demo-web/.env being present.
const STRIPE_PUBLISHABLE_KEY =
  "pk_live_51U6Hyg0OopDPziclNw1KwtgP6pHPR2K87B0QoVGTwoQYcCcJAZsHHpYZDsxT7kPv5wgnocwjdOad7tTj3I6wllhI00LIJFeqiy";

// Production backend origin. Only applied to `vite build` (not `vite` dev
// server, which uses the `/v1` proxy below to stay single-origin). When
// defined, `import.meta.env.VITE_API_ORIGIN` in App.tsx resolves to this
// absolute URL so the deployed bundle talks to the real backend directly.
const PRODUCTION_API_ORIGIN = "https://tea.api.thoughtfulkoala.com";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Replace `import.meta.env.VITE_STRIPE_PUBLIC_KEY` references in the
  // bundle with the literal string above. Vite's `define` does a
  // build-time text replacement, so the key is inlined and no env var is
  // read at runtime.
  // `VITE_API_ORIGIN` is only defined for production builds (`vite build`);
  // in dev it stays undefined so App.tsx falls back to "" and uses the
  // same-origin proxy.
  define: {
    "import.meta.env.VITE_STRIPE_PUBLIC_KEY": JSON.stringify(
      STRIPE_PUBLISHABLE_KEY,
    ),
    ...(command === "build" && {
      "import.meta.env.VITE_API_ORIGIN": JSON.stringify(
        PRODUCTION_API_ORIGIN,
      ),
    }),
  },
  server: {
    port: 5173,
    // The demo talks to the Go backend on :8888. Proxy keeps the browser
    // on a single origin so we don't need CORS in dev.
    proxy: {
      "/v1": "http://localhost:8888",
    },
  },
}));
