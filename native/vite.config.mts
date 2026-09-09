import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/postcss';
import {fileURLToPath} from 'node:url';

export default defineConfig({
  root:fileURLToPath(new URL('./web',import.meta.url)),
  base:'./',
  plugins:[react()],
  css:{postcss:{plugins:[tailwind()]}},
  resolve:{alias:{'@':fileURLToPath(new URL('..',import.meta.url))}},
  build:{outDir:fileURLToPath(new URL('../.native-build/web',import.meta.url)),emptyOutDir:true},
});
