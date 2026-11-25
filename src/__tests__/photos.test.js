import { describe, it, expect } from "vitest";
import { slugify, racePhoto, heroPhoto } from "../lib/photos.js";

describe("photo slots", () => {
  it("slugifies race names the way the photos README documents", () => {
    expect(slugify("Tunkhannock Trail 50K")).toBe("tunkhannock-trail-50k");
    expect(slugify("Crête des Aiguilles 80K")).toBe("crete-des-aiguilles-80k");
    expect(slugify("  Valle Verde — Gran Fondo! ")).toBe("valle-verde-gran-fondo");
  });

  it("prefers the race's own photo, then its sport's, then the placeholder", () => {
    expect(heroPhoto()).toMatch(/hero/);
    expect(racePhoto({ name: "Lakefront 10K", sport: "Road Running" })).toMatch(/race-lakefront-10k/);
    expect(racePhoto({ name: "Some New Trail Race", sport: "Trail Running" })).toMatch(/sport-trail-running/);
    expect(racePhoto({ name: "Some Swim", sport: "Swimming" })).toBeNull();
    expect(racePhoto(null)).toBeNull();
  });
});
