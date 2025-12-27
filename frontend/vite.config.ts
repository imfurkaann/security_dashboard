import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  esbuild: {
    // Remove all console statements in production for security
    // Keep them in development for debugging
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  }
}))
