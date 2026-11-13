import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "../vite.config.js";
import { htmlEntries, probeSharePreview, validateEntries } from "./share-preview.mjs";

const dist = path.resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const entries = htmlEntries(config);
const readDist = (entry) => readFileSync(path.join(dist, path.basename(entry.file)), "utf8");
const findings = [
  ...validateEntries(entries, readDist, dist),
  ...await probeSharePreview(dist, entries),
];
if (findings.length > 0) {
  console.error(findings.join("\n"));
  process.exit(1);
}
console.log(`Prévia de compartilhamento ok em ${entries.length} páginas`);
