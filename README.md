# gta6-cover-art
[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/leopad12121/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/leopad12121/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

**Vice Cover Studio** — a fully offline web app that turns your photos into a
sunset-soaked, GTA-style cover poster. Pick a layout (three diagonal panels, a
duo split, or a single hero shot), drop in your own photos or use the bundled
samples, pan and zoom each panel, choose a colour grade (Vice City sunset,
neon, noir), write your caption, and export a print-ready PNG at 1920×1080,
1080×1350 or 1080×1080.

The cover is rendered on canvas: a gradient sunset sky with a striped retro
sun, procedural palm-tree and skyline silhouettes, halftone dots and film
grain, and bold condensed caption lettering with a thick outline. Photos never
leave your machine — everything runs locally in the browser.

## Run it

Serve the `app/` folder with any static server and open `app/index.html`, for
example:

```sh
python3 -m http.server --directory app 8080
# then open http://localhost:8080/
```

No build step, no dependencies, no network requests at runtime.

## Credits

- Typeface: **Anton** by Vernon Adams, licensed under the SIL Open Font License
  1.1 (see `app/fonts/OFL.txt`).
- Sample photos: kit-provided images plus one AI-generated fictional portrait
  (`app/samples/portrait.jpg` — the person shown is entirely fictional).
- Fan-made tool, not affiliated with Rockstar Games. No Rockstar artwork,
  logos, wordmarks or fonts are used.
