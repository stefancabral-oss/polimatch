import { inauguralChroma } from './inaugural-chromas.js';

export function escapeCardText(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

// Framing belongs to the card viewport; source photographs remain byte-identical.
export function portraitStyle(photo = {}) {
  const position = /^(?:center|\d{1,3}% \d{1,3}%)$/.test(photo.position || "")
    ? photo.position
    : "center top";
  if (
    photo.crop &&
    [photo.crop.x, photo.crop.y, photo.crop.width].every(Number.isFinite) &&
    photo.crop.x >= 0 &&
    photo.crop.y >= 0 &&
    photo.crop.width > 0 &&
    photo.crop.x + photo.crop.width <= 1 &&
    photo.crop.y < 1
  ) {
    return `position:absolute;width:${100 / photo.crop.width}%;height:auto;max-width:none;left:0;top:0;transform:translate(-${photo.crop.x * 100}%,-${photo.crop.y * 100}%);`;
  }
  const rotation = [-90, 90, 180].includes(photo.rotation)
    ? `transform:rotate(${photo.rotation}deg);`
    : "";
  return `object-position:${position};object-fit:${photo.fit === "contain" ? "contain" : "cover"};${rotation}`;
}

let cropSequence = 0;
export function portraitMarkup(photo, { alt = "", loading = "eager" } = {}) {
  const e = escapeCardText;
  const crop = photo?.crop;
  if (crop?.height && photo.width && photo.height) {
    const viewBox = [
      crop.x * photo.width,
      crop.y * photo.height,
      crop.width * photo.width,
      crop.height * photo.height,
    ].join(" ");
    const clip = `portrait-clip-${++cropSequence}`;
    return `<svg class="portrait-viewport" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" ${alt ? `role="img" aria-label="${e(alt)}"` : 'aria-hidden="true"'}><defs><clipPath id="${clip}"><rect x="${crop.x * photo.width}" y="${crop.y * photo.height}" width="${crop.width * photo.width}" height="${crop.height * photo.height}"/></clipPath></defs><image clip-path="url(#${clip})" href="${e(photo.path)}" width="${photo.width}" height="${photo.height}"/></svg>`;
  }
  return `<img src="${e(photo?.path || photo || "")}" style="${portraitStyle(photo)}" alt="${e(alt)}" loading="${loading}" decoding="async">`;
}

export function tcgCardMarkup(
  person,
  { decorative = false, category = "Corrida presidencial", index = 0, chroma = inauguralChroma(person.id) } = {},
) {
  const e = escapeCardText;
  const serial = String(person.personId || index + 1).padStart(3, "0");
  const content = `${chroma ? `<img class="tcg-complete-art" data-chroma-art src="${e(chroma.src)}" srcset="${e(chroma.srcset)}" sizes="(max-width: 640px) 45vw, 300px" width="1060" height="1484" alt="" decoding="async">` : ''}<span class="tcg-edge" aria-hidden="true"></span>
    <span class="tcg-art">${portraitMarkup(person.photo, { alt: decorative ? "" : `Retrato de ${person.name}` })}</span>
    <span class="tcg-foil" aria-hidden="true"></span><span class="tcg-etching" aria-hidden="true"></span>
    <span class="tcg-top" aria-hidden="true"><img src="./brand/symbol-monochrome.svg" alt=""><span>POLIMATCH</span><b>✦</b></span>
    <span class="tcg-choice" aria-hidden="true" hidden></span>
    <span class="tcg-caption"><span class="tcg-category">${e(category)}</span><strong class="tcg-name">${e(person.name)}</strong><span class="tcg-outcome" hidden></span></span>
    <span class="tcg-footer" aria-hidden="true"><span>CHROMA · MALAQUITA</span><span>${serial} / 2026</span></span>
    <span class="tcg-spark" aria-hidden="true">✧</span>`;
  return decorative
    ? `<span class="tcg-card tcg-card--decorative${chroma ? ' tcg-card--inaugural' : ''}" data-hologram aria-hidden="true">${content}</span>`
    : `<button class="tcg-card${chroma ? ' tcg-card--inaugural' : ''}" type="button" data-card="${e(person.id)}" data-hologram aria-pressed="false" aria-label="Escolher ${e(person.name)} em primeiro lugar${chroma ? ', retrato artístico com IA' : ''}">${content}</button>`;
}
