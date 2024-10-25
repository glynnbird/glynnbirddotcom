import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://glynnbird.com',
  build: {
    inlineStylesheets: 'always'
  }
});
