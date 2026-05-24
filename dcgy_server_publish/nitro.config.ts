import { defineNitroConfig } from 'nitropack/config'

export default defineNitroConfig({
  compatibilityDate: '2025-01-01',
  experimental: {
    websocket: true
  },
  preset: 'node-server',
  srcDir: '.',
  scanDirs: ['server']
})
