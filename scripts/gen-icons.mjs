import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = resolve(__dirname, "../public/pwa-icon.svg");
const svg = readFileSync(svgPath, "utf-8");

function render(size, outPath) {
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: size } });
  const pngData = resvg.render();
  writeFileSync(outPath, pngData.asPng());
  console.log(`✓ ${outPath} (${size}x${size})`);
}

render(180, resolve(__dirname, "../public/apple-touch-icon.png"));
render(512, resolve(__dirname, "../public/pwa-icon-512.png"));
