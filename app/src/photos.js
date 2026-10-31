const PHOTO_SLOT_MIN = 1;
const PHOTO_SLOT_MAX = 125;
// Mapa caminho -> prefixo do sha256 da imagem, gerado no build (scripts/release-identity.mjs).
// A versão só muda quando o arquivo muda; fora do build (testes em Node) o mapa é vazio.
const ASSET_HASHES = typeof __POLIMATCH_ASSET_HASHES__ === "undefined" ? {} : __POLIMATCH_ASSET_HASHES__;
const LOCAL_ASSET_PATH_PATTERN = /^\/(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*[A-Za-z0-9][A-Za-z0-9._-]*$/;

export const PHOTO_SLOT_COUNT = PHOTO_SLOT_MAX;

export function versionedAssetUrl(path, hashes = ASSET_HASHES) {
  const hash = Object.hasOwn(hashes, path) ? String(hashes[path]) : "";
  return /^[0-9a-f]{8,64}$/.test(hash) ? `${path}?v=${hash}` : path;
}

export function portraitSlot(personId) {
  const slot = Number(personId);
  if (!Number.isInteger(slot) || slot < PHOTO_SLOT_MIN || slot > PHOTO_SLOT_MAX) return "";
  return versionedAssetUrl(`/portraits/${String(slot).padStart(3, "0")}.jpg`);
}

function approvedLocalAsset(asset = {}) {
  const image = String(asset.image || "");
  if (asset.status !== "approved" || !LOCAL_ASSET_PATH_PATTERN.test(image)) return "";
  return versionedAssetUrl(image);
}

export function candidateCardArt(candidate = {}) {
  return candidateDocumentaryPhoto(candidate) || approvedLocalAsset(candidate.publication?.cardArt);
}

export function candidateDocumentaryPhoto(candidate = {}) {
  const asset = candidate.publication?.documentaryPhoto;
  return approvedLocalAsset(asset?.status === "restored" ? { ...asset, status: "approved" } : asset);
}
