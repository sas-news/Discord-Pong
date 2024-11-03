import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  envDir: "../",
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3690",
        changeOrigin: true,
        secure: true,
        ws: true,
      },
    },
    hmr: {
      clientPort: 443,
    },
  },
  plugins: [react()],
});
