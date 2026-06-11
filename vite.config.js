import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true // Live-Test auf dem iPad im selben WLAN
  },
  build: {
    target: 'es2018' // ältere iPad-Safaris
  }
});
