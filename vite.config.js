import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendTarget = process.env.VITE_BACKEND_TARGET || 'http://localhost:5001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/expand': backendTarget,
      '/expand_recursive': backendTarget,
      '/search': backendTarget,
      '/departments': backendTarget,
      '/skills': backendTarget,
      '/employees': backendTarget,
      '/overrides': backendTarget,
      '/filter-options': backendTarget,
      '/admin-change-requests': backendTarget,
      '/auth': backendTarget,
      '/events': backendTarget,
      '/ingestion': backendTarget,
    },
  },
});
