import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";
import { mkdirSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = "file://" + path.resolve(__dirname, "../deck/diagrams.html");
const outDir = path.resolve(__dirname, "../deck/diagrams");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.goto(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1000);

for (const id of ["erd", "arch"]) {
  const el = page.locator(`#${id}`);
  await el.screenshot({ path: path.join(outDir, `${id}.png`) });
  console.log("rendered", id);
}
await browser.close();
console.log("done");
