# Photos

Drop images here and RaceIQ picks them up at build time by file name. Without
a photo, a topographic placeholder is drawn instead. See
`docs/design-visual-identity.md`.

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

## Credits

The current photos are from [Unsplash](https://unsplash.com), used under the
[Unsplash License](https://unsplash.com/license). Each was cropped to 3:2 and
compressed to 1600 px wide.

| File | Photographer |
|---|---|
| `hero.jpg` | Brian Metzler |
| `race-tunkhannock-trail-50k.jpg` | Oliver Schmid |
| `race-brandywine-valley-marathon.jpg` | Tara Glaser |
| `race-lakefront-10k.jpg` | Lucas Canino |
| `race-hollow-road-gravel-classic.jpg` | Justin Kauffman |
| `sport-trail-running.jpg` | Brian Erickson |
| `sport-road-running.jpg` | Todd Diemer |
| `sport-gravel-cycling.jpg` | Racim Amr |
| `sport-road-cycling.jpg` | Ryuta F |

All are trail-running scenes, so the cycling and road slots are stand-ins until
photos of those sports are added.
