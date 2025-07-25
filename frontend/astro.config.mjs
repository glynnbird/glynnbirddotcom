import { defineConfig } from 'astro/config'
import htmlBeautifier from 'astro-html-beautifier'

// https://astro.build/config
export default defineConfig({
  site: 'https://glynnbird.com',
  build: {
    inlineStylesheets: 'always'
  },
  integrations: [
    htmlBeautifier({
        indent_size: 2,
        brace_style: "collapse"
    })
  ]
})
