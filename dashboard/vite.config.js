import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  build: {
    outDir: 'dist',
    // Split vendor chunks for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          react:    ['react', 'react-dom'],
          charts:   ['recharts'],
          icons:    ['lucide-react'],
          zustand:  ['zustand'],
        },
      },
    },
    // Raise warning limit — our app is feature-rich
    chunkSizeWarningLimit: 800,
    // Disable minification on low-RAM machines; Vercel cloud will minify fine
    minify: process.env.CI ? true : false,
  },

  server: {
    port: 5173,
    // Only proxy to backend when running locally with backend
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
    },
  },

  // Make Vite resolve @ as src alias
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
