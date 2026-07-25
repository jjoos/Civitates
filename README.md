# Civitates

An experiment in bringing historical cities back to life in 3D: real
geo-coordinates, buildings placed and dated from historical maps,
paintings, photos and text, navigable in the browser with a time slider,
published as a static site on GitHub Pages.

First case study: **Hoorn**, Netherlands.

See [docs/concept.md](docs/concept.md) for the concept, scoping decisions,
data pipeline, and phased roadmap.

## Development

```sh
npm install
npm run dev      # local dev server
npm run build    # production build to dist/
```

Built with [three.js](https://threejs.org/) + Vite. Deploys automatically
to GitHub Pages on push to `main` via `.github/workflows/deploy.yml` — this
requires enabling Pages in the repo settings with source set to "GitHub
Actions".
