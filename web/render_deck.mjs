import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const deckHtml = "file://" + path.resolve(__dirname, "../deck/fakerni_deck.html");
const outDir = path.resolve(__dirname, "../deck/slides");

import { mkdirSync } from "fs";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
await page.goto(deckHtml, { waitUntil: "networkidle" });
// ensure webfonts are loaded
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1200);

const slides = await page.locator(".slide").all();
console.log("found", slides.length, "slides");

let i = 1;
for (const s of slides) {
  const n = String(i).padStart(2, "0");
  await s.screenshot({ path: path.join(outDir, `slide_${n}.png`) });
  console.log("rendered slide", n);
  i++;
}

await browser.close();
console.log("done");
