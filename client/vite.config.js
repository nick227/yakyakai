import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Forward cookies from the client to the backend
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie)
            }
          })
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // Forward Set-Cookie headers from backend to client
            const setCookieHeaders = proxyRes.headers['set-cookie']
            if (setCookieHeaders) {
              res.setHeader('Set-Cookie', setCookieHeaders)
            }
          })
        },
      },
    },
  },
})
