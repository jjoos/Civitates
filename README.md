# Civitates

An experiment in bringing historical cities back to life in 3D: real
geo-coordinates, buildings placed and dated from historical maps,
paintings, photos and text, navigable in the browser with a time slider,
published as a static site on GitHub Pages.

First case study: **Hoorn**, Netherlands.

See [docs/concept.md](docs/concept.md) for the concept, scoping decisions,
data pipeline, and phased roadmap.

**Read [docs/lessons.md](docs/lessons.md) before doing measurement work.** Every
substantive error here has produced a plausible number that passed every
internal check; that file is the list of what actually caught them.

| | |
|---|---|
| [docs/concept.md](docs/concept.md) | concept, scoping, roadmap |
| [docs/lessons.md](docs/lessons.md) | how measurements went wrong and what caught them |
| [docs/georeferencing.md](docs/georeferencing.md) | coordinate system, per-map findings, dead ends |
| [docs/fortifications.md](docs/fortifications.md) | gates and walls: which map, and why |
| [data/historic-streets/](data/historic-streets/) | houses projected onto surviving streets |
| [data/historic-rasters/](data/historic-rasters/) | blocks from georeferenced sheets |
| [data/landmarks/](data/landmarks/) | landmark index to collect sources against |

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
