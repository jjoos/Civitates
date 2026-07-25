import { defineConfig } from 'vite';

// Repo is published as a GitHub Pages project site, so assets must be
// requested under /Civitates/ rather than the domain root.
export default defineConfig({
  base: '/Civitates/',
});
