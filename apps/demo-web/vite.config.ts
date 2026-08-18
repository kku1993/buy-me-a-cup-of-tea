import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The demo talks to the Go backend on :8888. Proxy keeps the browser
    // on a single origin so we don't need CORS in dev.
    proxy: {
      "/v1": "http://localhost:8888",
    },
  },
});
