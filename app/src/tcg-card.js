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
    : "center 20%";
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
  return `object-position:${position};${rotation}`;
}

export function tcgCardMarkup(
  person,
  { decorative = false, category = "Corrida presidencial", index = 0 } = {},
) {
  const e = escapeCardText;
  const image = person.photo?.path || person.photo || "";
  const serial = String(person.personId || index + 1).padStart(3, "0");
  const content = `<span class="tcg-edge" aria-hidden="true"></span>
    <span class="tcg-art"><img src="${e(image)}" style="${portraitStyle(person.photo)}" alt="${decorative ? "" : `Retrato de ${e(person.name)}`}" ${decorative ? 'loading="eager"' : 'decoding="async"'}></span>
    <span class="tcg-foil" aria-hidden="true"></span><span class="tcg-etching" aria-hidden="true"></span>
    <span class="tcg-top" aria-hidden="true"><img src="./brand/symbol-monochrome.svg" alt=""><span>POLIMATCH</span><b>✦</b></span>
    <span class="tcg-choice" aria-hidden="true" hidden></span>
    <span class="tcg-caption"><span class="tcg-category">${e(category)}</span><strong class="tcg-name">${e(person.name)}</strong><span class="tcg-outcome" hidden></span></span>
    <span class="tcg-footer" aria-hidden="true"><span>CHROMA · MALAQUITA</span><span>${serial} / 2026</span></span>
    <span class="tcg-spark" aria-hidden="true">✧</span>`;
  return decorative
    ? `<span class="tcg-card tcg-card--decorative" data-hologram aria-hidden="true">${content}</span>`
    : `<button class="tcg-card" type="button" data-card="${e(person.id)}" data-hologram aria-pressed="false" aria-label="Escolher ${e(person.name)} em primeiro lugar">${content}</button>`;
}
