import assert from "node:assert/strict";
import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { groups } from "./site/screens.mjs";

const site = new URL("site/", import.meta.url);
const screenshots = new URL("../../out/unslop-site/screens/", import.meta.url);
const assets = new URL("assets/", site);
const publishedScreens = new URL("screens/", site);
const widths = { desktop: 1440, movil: 390 };
const ids = groups.flatMap(([, items]) => items.map(([id]) => id));

await Promise.all([mkdir(assets, { recursive: true }), mkdir(publishedScreens, { recursive: true })]);
for (const id of ids) {
  for (const [format, width] of Object.entries(widths)) {
    for (const theme of ["claro", "oscuro"]) {
      for (const view of ["actual", "propuesta"]) {
        const file = `${id}-${format}-${theme}-${view}.webp`;
        const source = new URL(file, screenshots);
        const metadata = await sharp(fileURLToPath(source)).metadata();
        assert.equal(metadata.width, width, `Wrong capture width: ${file}`);
        await copyFile(source, new URL(file, publishedScreens));
      }
    }
  }
}

for (const [name, source] of [
  ["paessed-logo.svg", "../../public/paessed-logo.svg"],
  ["plus-jakarta-sans-latin-wght-normal.woff2", "../../node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2"],
  ["plus-jakarta-sans-LICENSE.txt", "../../node_modules/@fontsource-variable/plus-jakarta-sans/LICENSE"],
]) {
  await copyFile(new URL(source, import.meta.url), new URL(name, assets));
}

console.log(`${ids.length} screens and ${ids.length * 8} checked captures in prototypes/unslop-site/site`);
