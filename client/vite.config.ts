import { defineConfig } from 'vite';

export default defineConfig({
  // We can leave this empty for now or add specific plugins later if needed.
  // For example, to ensure assets from a public directory are copied:
  // publicDir: 'public',
  server: {
    port: 3000, // You can specify a port for the dev server
    open: true // Automatically open the app in the browser on server start
  },
  build: {
    outDir: 'dist' // Specifies the output directory for the build
  }
}); 