// Build the Story Editor as a static site inside the phone app's folder (docs/play/edit), so it shares the game's
// engine files: python ../tools/build_phone_app.py runs this after the phone app.
import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  publicDir: "public-edit",
  build: {
    outDir: path.resolve(__dirname, "../../docs/play/edit"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: { input: path.resolve(__dirname, "edit.html") },
  },
});
