import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true },
  // shared/ lives outside the web root; '..' resolves against root, i.e. the repo.
  server: { proxy: { '/api': 'http://localhost:8080' }, fs: { allow: ['..'] } },
});
