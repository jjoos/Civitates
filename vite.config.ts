import { defineConfig } from 'vite';

// Repo is published as a GitHub Pages project site, so assets must be
// requested under /Civitates/ rather than the domain root.
//
// Two entry points: the 3D viewer, and the tracing editor at /editor.html
// (docs/editor.md). The editor is deployed rather than kept local on purpose —
// tracing a plate with a stylus on a tablet is markedly better than with a
// mouse, and that only works if the tool is on a URL.
export default defineConfig({
  base: '/Civitates/',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        editor: 'editor.html',
      },
    },
  },
});
