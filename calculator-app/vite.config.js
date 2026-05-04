import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const nm = path.resolve(__dirname, 'node_modules')

export default defineConfig({
  plugins: [react({ jsxRuntime: 'classic' })],
  resolve: {
    alias: {
      'react':          path.join(nm, 'react'),
      'react-dom':      path.join(nm, 'react-dom'),
      'react-dom/client': path.join(nm, 'react-dom', 'client.js'),
      'recharts':       path.join(nm, 'recharts'),
    },
  },
  build: {
    outDir: 'dist-standalone',
    rollupOptions: {
      external: (id) => ['react', 'react-dom', 'recharts'].some(
        (pkg) => id === pkg || id.startsWith(pkg + '/')
      ),
      output: {
        format: 'iife',
        entryFileNames: 'app.js',
        assetFileNames: 'app.[ext]',
        inlineDynamicImports: true,
        globals: (id) => {
          if (id === 'react') return 'React';
          if (id.startsWith('react-dom')) return 'ReactDOM';
          if (id === 'recharts') return 'Recharts';
        },
      },
    },
  },
})
