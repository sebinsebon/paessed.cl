import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Trophy } from "lucide-react";

const output = new URL("../../out/unslop-m1/", import.meta.url);
const assets = new URL("assets/", output);
const repo = new URL("../../", import.meta.url);

await mkdir(assets, { recursive: true });
await Promise.all([
  ...["index.html", "demo.css", "demo.js", "vercel.json"].map(file =>
    copyFile(new URL(file, import.meta.url), new URL(file, output))),
  copyFile(new URL("public/paessed-logo.svg", repo), new URL("paessed-logo.svg", assets)),
  copyFile(
    new URL("node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2", repo),
    new URL("plus-jakarta-sans-latin-wght-normal.woff2", assets),
  ),
  copyFile(new URL("node_modules/@fontsource-variable/plus-jakarta-sans/LICENSE", repo), new URL("plus-jakarta-sans-LICENSE.txt", assets)),
  copyFile(new URL("node_modules/lucide-react/LICENSE", repo), new URL("lucide-LICENSE.txt", assets)),
  writeFile(new URL("trophy.svg", assets), renderToStaticMarkup(createElement(Trophy, { color: "#a7540b" }))),
]);

console.log("Static prototype built in out/unslop-m1");
