# Photos

Drop images here and RaceIQ picks them up at build time by file name. Nothing
ships in this folder by default; without a photo, a topographic placeholder is
drawn instead. See `docs/design-visual-identity.md`.

| File name | Shown on |
|---|---|
| `hero.jpg` | The home page hero |
| `race-<race-name>.jpg` | That race's card and analysis header |
| `sport-trail-running.jpg` | Any trail race without its own photo |
| `sport-road-running.jpg` | Any road run without its own photo |
| `sport-road-cycling.jpg` | Any road ride without its own photo |
| `sport-gravel-cycling.jpg` | Any gravel ride without its own photo |

`<race-name>` is the race name in lowercase, with anything that isn't a letter
or digit turned into a hyphen and accents removed:
"Tunkhannock Trail 50K" → `race-tunkhannock-trail-50k.jpg`,
"Crête des Aiguilles" → `race-crete-des-aiguilles.jpg`.

`.jpg`, `.jpeg`, `.png`, `.webp` and `.avif` all work. Landscape photos around
1600 px wide, under ~300 KB, look best. Only use photos you have the rights to.
