import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isLowRam = process.env.VITE_LOW_RAM_BUILD === 'true';
  
  return {
    plugins: [react()],
    esbuild: {
      // Remove all console statements in production for security
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
    build: {
      chunkSizeWarningLimit: 2000,
      target: 'es2020',
      cssCodeSplit: true,
      minify: isLowRam ? false : 'esbuild', // RAM tasarrufu için minification kapatılabilir
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (isLowRam) {
              // Düşük RAM modunda chunk bölmeyi kapatarak Rollup AST belleğini azaltıyoruz
              return undefined;
            }
            if (id.includes('node_modules')) {
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('@tiptap')) {
                return 'vendor-editor';
              }
              if (
                id.includes('react') ||
                id.includes('react-dom') ||
                id.includes('react-router-dom') ||
                id.includes('scheduler') ||
                id.includes('antd') ||
                id.includes('@ant-design') ||
                id.includes('@rc-component') ||
                id.includes('rc-')
              ) {
                return 'vendor-core';
              }
              if (id.includes('recharts') || id.includes('d3')) {
                return 'vendor-charts';
              }
              if (id.includes('jspdf') || id.includes('exceljs') || id.includes('html2canvas') || id.includes('pdfjs-dist') || id.includes('jszip')) {
                return 'vendor-docs';
              }
              return 'vendor-others';
            }
          }
        }
      }
    }
  }
})
