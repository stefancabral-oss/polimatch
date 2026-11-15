import { defineConfig } from "vite";
import { releaseIdentity } from "./scripts/release-identity.mjs";

export default defineConfig({
  base: "./",
  plugins: [releaseIdentity()],
  build: {rollupOptions: {input: {main: "index.html", howItWorks: "como-funciona.html"}}},
  server: {
    host: true,
    port: 5174,
    proxy: { "/api": "http://localhost:3001" },
  },
  preview: {
    host: true,
    port: 4174,
  },
});
