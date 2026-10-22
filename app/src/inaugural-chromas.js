import CHROMAS from './inaugural-chromas.json' with { type: 'json' };

const byPerson = new Map(CHROMAS.map((art) => [art.id, art]));
export function inauguralChroma(personId) {
  return byPerson.get(personId) || null;
}

// Keep the original card visible until its complete artwork is actually loaded.
// Capture also handles cards added later to the arena, podium and profile dialog.
export function installInauguralChromas(root) {
  const settle = (event) => {
    const image = event.target;
    if (!image?.matches?.('[data-chroma-art]')) return;
    image.closest('.tcg-card')?.classList.toggle(
      'is-chroma-ready', image.complete && image.naturalWidth > 0,
    );
  };
  root.addEventListener('load', settle, true);
  root.addEventListener('error', settle, true);
  root.querySelectorAll('[data-chroma-art]').forEach((image) => settle({ target: image }));
  return () => {
    root.removeEventListener('load', settle, true);
    root.removeEventListener('error', settle, true);
  };
}
