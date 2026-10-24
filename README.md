# gift-scratch

A small scratch-card birthday page. Static HTML, CSS and JavaScript with no build step, served by GitHub Pages from the root of `main`.

## Run locally

ES modules need a web server, so opening `index.html` from disk will not work:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Layout

- `index.html`: markup and the link-preview tags
- `css/style.css`: all styling
- `js/main.js`: the intro, scratch and reveal flow
- `js/scratch.js`: the canvas foil and scratch progress
- `js/fx.js`: particles (foil flakes, confetti, falling cash)
- `js/sound.js`: synthesized sound effects
- `js/countdown.js`: time until midnight in Athens
- `assets/`: card art and the link-preview image
