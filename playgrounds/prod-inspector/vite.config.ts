import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// No plugin here on purpose: this models a production build where the app mounts the inspector itself.
export default defineConfig({
	root: fileURLToPath(new URL('.', import.meta.url)),
})
