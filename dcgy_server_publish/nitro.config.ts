import { defineNitroConfig } from 'nitropack/config'

export default defineNitroConfig({
  compatibilityDate: '2025-01-01',
  preset: 'node-server',
  srcDir: '.',
  scanDirs: ['server']
})
