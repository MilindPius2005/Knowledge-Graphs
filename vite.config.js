import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/expand': 'http://localhost:5000',
      '/expand_recursive': 'http://localhost:5000',
      '/search': 'http://localhost:5000',
      '/departments': 'http://localhost:5000',
      '/skills': 'http://localhost:5000',
      '/employees': 'http://localhost:5000',
      '/overrides': 'http://localhost:5000',
    },
  },
});
