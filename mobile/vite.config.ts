import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Listen on the local network so a phone on the same wifi or hotspot can open it
  server: { host: true },
})
