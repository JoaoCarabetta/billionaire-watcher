// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  redirects: {
    '/indice': {
      status: 308,
      destination: '/',
    },
    '/indice/': {
      status: 308,
      destination: '/',
    },
  },
});
