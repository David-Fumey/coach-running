import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  // Port fixe : le localStorage est rattaché à l'adresse, un autre port ferait repartir de zéro.
  // Il peut être imposé par l'environnement (PORT), sinon 5173.
  server: { port: process.env.PORT ? Number(process.env.PORT) : 5173, strictPort: true },
});
