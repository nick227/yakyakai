import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const shouldAnalyze = process.env.BUNDLE_ANALYZE === '1'
const CHUNK_RULES = [
  ['vendor-mermaid-core', ['mermaid', 'cytoscape', 'cose-base', 'cytoscape-cose-bilkent']],
  ['vendor-katex', ['katex']],
  ['vendor-diagram-layout', ['dagre', 'elkjs', 'd3']],
  ['vendor-apex', ['apexcharts']],
  ['vendor-frappe', ['frappe-charts', 'chart.js']],
  ['vendor-effects', ['tsparticles', '@tsparticles', 'roughjs', 'typed.js']],
]

const manualChunks = (id) => {
  if (!id.includes('node_modules')) return undefined
  for (const [chunkName, packages] of CHUNK_RULES) {
    if (packages.some((pkg) => id.includes(`/node_modules/${pkg}/`) || id.includes(`\\node_modules\\${pkg}\\`))) {
      return chunkName
    }
  }
  return undefined
}

export default defineConfig(async () => {
  const plugins = [react(), tailwindcss()]

  if (shouldAnalyze) {
    const { visualizer } = await import('rollup-plugin-visualizer')
    plugins.push(visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
      template: 'treemap',
      open: false,
    }))
  }

  return {
    plugins,
  build: {
    rollupOptions: {
      output: {
        // Keep chunking rules minimal and predictable for cache stability.
        manualChunks,
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
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
  }
})
