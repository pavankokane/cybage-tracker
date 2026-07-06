import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    build: {
      sourcemap: false,
      minify: 'esbuild'
    }
  },

  preload: {
    build: {
      sourcemap: false,
      minify: 'esbuild'
    }
  },

  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },

    plugins: [react(), tailwindcss()],

    build: {
      sourcemap: false,
      minify: 'esbuild'
    }
  }
})
