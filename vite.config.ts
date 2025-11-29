import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables from .env

const FRONTEND_PORT = Number(process.env.FRONTEND_PORT) || 3001;
const BACKEND_PORT = Number(process.env.PORT) || 3000;
const API_BASE_URL =
  process.env.VITE_API_BASE_URL || `http://localhost:${BACKEND_PORT}`;

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/frontend",
    rollupOptions: {
      input: "./index.html",
    },
    emptyOutDir: false,
    cssCodeSplit: true,
  },
  publicDir: "public",
  server: {
    port: FRONTEND_PORT,
    proxy: {
      "/api": {
        target: API_BASE_URL,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
