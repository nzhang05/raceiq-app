/*
  Photos the athlete has added to src/assets/photos, found by file name at
  build time (see the README in that folder). Vite fingerprints each file and
  hands back its URL, so a photo costs nothing until it's added.

  Every lookup returns a URL or null. A null means "draw the placeholder" —
  RaceIQ never substitutes a stock or generated image for a real race.
*/
const files = import.meta.glob("../assets/photos/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP}", {
  eager: true,
  import: "default",
});

const BY_NAME = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.split("/").pop().replace(/\.[^.]+$/, "").toLowerCase(), url]),
);

// "Crête des Aiguilles 80K" → "crete-des-aiguilles-80k"
export function slugify(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function heroPhoto() {
  return BY_NAME.hero ?? null;
}

// The race's own photo, else one for its sport, else null.
export function racePhoto(race) {
  if (!race) return null;
  return BY_NAME[`race-${slugify(race.name)}`] ?? BY_NAME[`sport-${slugify(race.sport)}`] ?? null;
}
