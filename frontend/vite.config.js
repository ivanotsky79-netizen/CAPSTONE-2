import { defineConfig } from 'vite' // Vercel Trigger 2
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
})
