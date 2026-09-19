import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'mobile-app',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 43123,
    strictPort: false,
    proxy: {
      '/api': 'http://127.0.0.1:5173',
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 43123,
    strictPort: false,
  },
});
