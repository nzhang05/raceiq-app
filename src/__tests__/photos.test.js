import { describe, it, expect } from "vitest";
import { slugify, racePhoto, heroPhoto } from "../lib/photos.js";

describe("photo slots", () => {
  it("slugifies race names the way the photos README documents", () => {
    expect(slugify("Tunkhannock Trail 50K")).toBe("tunkhannock-trail-50k");
    expect(slugify("Crête des Aiguilles 80K")).toBe("crete-des-aiguilles-80k");
    expect(slugify("  Valle Verde — Gran Fondo! ")).toBe("valle-verde-gran-fondo");
  });

  it("returns null when no photo was added, so the placeholder is drawn", () => {
    expect(heroPhoto()).toBeNull();
    expect(racePhoto({ name: "Lakefront 10K", sport: "Road Running" })).toBeNull();
    expect(racePhoto(null)).toBeNull();
  });
});
