import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  // Le port peut être imposé par l'environnement (PORT), sinon 5173.
  server: process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : {},
});
