import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000, // You can specify a port for the dev server
    open: true // Automatically open the app in the browser on server start
  },
  build: {
    outDir: 'dist' // Specifies the output directory for the build
  }
}); 