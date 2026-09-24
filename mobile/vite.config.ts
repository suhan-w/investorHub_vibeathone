import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Listen on the local network so a phone on the same wifi or hotspot can open it.
  // Fixed port because the Scriptable widget points at it.
  server: { host: true, port: 5173, strictPort: true },
})
