// One-off: app icons for the installable app (PWA) from the logo's "b." mark
// (src/app/icon.svg). Re-run if the logo changes:  node scripts/make-icons.mts
import { mkdirSync, readFileSync } from "node:fs";
import sharp from "sharp";

const mark = readFileSync("src/app/icon.svg", "utf8");
const inner = mark.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const NAVY = "#16233A"; // the logo's own colour (design/brand)

// Maskable: Android may cut the icon into a circle — keep the mark inside the middle 60 %.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${NAVY}"/><g transform="translate(20 20) scale(0.6)">${inner}</g></svg>`;
// iOS: square, no transparency, iOS rounds the corners itself.
const square = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${NAVY}"/><g transform="translate(8 8) scale(0.84)">${inner}</g></svg>`;

mkdirSync("public/icons", { recursive: true });
const out = async (svg: string, size: number, file: string) =>
  sharp(Buffer.from(svg)).resize(size, size).png().toFile(`public/icons/${file}`);

await out(mark, 192, "icon-192.png");
await out(mark, 512, "icon-512.png");
await out(maskable, 512, "maskable-512.png");
await out(square, 180, "apple-touch-icon.png");
console.log("✓ public/icons: icon-192, icon-512, maskable-512, apple-touch-icon");
