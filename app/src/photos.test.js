import assert from "node:assert/strict";
import test from "node:test";
import { PHOTO_SLOT_COUNT, candidateCardArt, candidateDocumentaryPhoto, portraitSlot, versionedAssetUrl } from "./photos.js";

test("all 125 people have a stable replaceable portrait slot", () => {
  assert.equal(PHOTO_SLOT_COUNT, 125);
  assert.equal(portraitSlot(1), "/portraits/001.jpg");
  assert.equal(portraitSlot(55), "/portraits/055.jpg");
  assert.equal(portraitSlot(125), "/portraits/125.jpg");
  assert.equal(portraitSlot(126), "");
});

test("files and legacy fields never bypass explicit editorial asset approval", () => {
  assert.equal(candidateCardArt({ personId: 1, cardArt: "/chromas/approved/001.jpg" }), "");
  assert.equal(candidateDocumentaryPhoto({ personId: 101, photo: "/portraits/101.jpg" }), "");
  assert.equal(candidateDocumentaryPhoto({ publication: { documentaryPhoto: { status: "rejected", image: "/portraits/101.jpg" } } }), "");
});

test("cards prefer photographs and retain approved artwork as a fallback", () => {
  const candidate = {
    publication: {
      cardArt: { status: "approved", image: "/chromas/fixture.jpg" },
      documentaryPhoto: { status: "approved", image: "/portraits/fixture.jpg" },
    },
  };
  assert.equal(candidateCardArt(candidate), "/portraits/fixture.jpg");
  assert.equal(candidateCardArt({ publication: { cardArt: candidate.publication.cardArt } }), "/chromas/fixture.jpg");
  assert.equal(candidateCardArt({ publication: { documentaryPhoto: { status: "restored", image: "/portraits/001.jpg" } } }), "/portraits/001.jpg");
  assert.equal(candidateDocumentaryPhoto(candidate), "/portraits/fixture.jpg");
  assert.equal(candidateCardArt({ publication: { cardArt: { status: "approved", image: "https://cdn.example/card.jpg" } } }), "");
  assert.equal(candidateCardArt({ publication: { cardArt: { status: "approved", image: "//cdn.example/card.jpg" } } }), "");
  assert.equal(candidateCardArt({ publication: { cardArt: { status: "approved", image: "/chromas/%2e%2e/card.jpg" } } }), "");
});

test("asset versions come from the content hash map, never from the build clock", () => {
  const hashes = { "/portraits/001.jpg": "a791320d", "/chromas/approved/001_x.jpg": "0123abcd" };
  assert.equal(versionedAssetUrl("/portraits/001.jpg", hashes), "/portraits/001.jpg?v=a791320d");
  assert.equal(versionedAssetUrl("/chromas/approved/001_x.jpg", hashes), "/chromas/approved/001_x.jpg?v=0123abcd");
  assert.equal(versionedAssetUrl("/portraits/002.jpg", hashes), "/portraits/002.jpg");
  assert.equal(versionedAssetUrl("/portraits/001.jpg", { "/portraits/001.jpg": "mvmryokm" }), "/portraits/001.jpg");
  assert.equal(versionedAssetUrl("__proto__", hashes), "__proto__");
  assert.equal(versionedAssetUrl("constructor", hashes), "constructor");
});
