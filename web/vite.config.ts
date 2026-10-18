import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [react(), basicSsl()],
  // Allow HTTPS tunnels (needed for phone tilt on iOS) to reach the dev/preview server.
  server: {
    host: true, port: 5173, https: {}, allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/socket.io': { target: process.env.GAME_PROXY_TARGET || 'http://127.0.0.1:3001', ws: true, changeOrigin: true },
      // Local fixture only. Do not expose server credentials through public tunnels.
      '/copilot': {
        target: 'http://127.0.0.1:8787', changeOrigin: true,
        rewrite: path => path.replace(/^\/copilot/, '') || '/',
        bypass(req, res) {
          const hostname = new URL(`http://${req.headers.host}`).hostname;
          if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
            res.statusCode = 403; res.end('Copilot fixture is available on this computer only.'); return false;
          }
        },
        configure(proxy) {
          proxy.on('proxyReq', (outgoing, req) => {
            // Rewrite only a verified same-origin browser request to the local fixture origin.
            const origin = req.headers.origin;
            try {
              if (origin && ['http:', 'https:'].includes(new URL(origin).protocol) && new URL(origin).host === req.headers.host) {
                outgoing.setHeader('Origin', 'http://127.0.0.1:8787');
              }
            } catch { /* Malformed/opaque origins stay unchanged and are rejected by the fixture. */ }
          });
        },
      },
    },
  },
  preview: { allowedHosts: ['.trycloudflare.com'] },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/postprocessing', 'postprocessing'],
        },
      },
    },
  },
});
