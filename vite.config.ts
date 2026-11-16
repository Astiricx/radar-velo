import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// En local, le site est servi à la racine. Sur GitHub Pages, il vit dans /radar-velo/ :
// le workflow « Site » fixe BASE_PATH pour que les fichiers soient trouvés.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
})
