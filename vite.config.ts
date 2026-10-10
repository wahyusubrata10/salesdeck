import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Path relatif agar bisa di-host di subfolder (GitHub Pages: /salesdeck/) maupun root (Cloudflare Pages).
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1000 }, // recharts + react + master barang tertanam
})
