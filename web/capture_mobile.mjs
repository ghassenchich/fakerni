import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();

// Mobile viewport (iPhone 14 Pro size)
await page.setViewportSize({ width: 390, height: 844 });

// Login
await page.goto("http://localhost:5173/login");
await page.waitForLoadState("networkidle");
await page.screenshot({ path: "screenshots/mobile_login.png" });
console.log("mobile login captured");

await page.fill("input[type=email]", "demo@fakerni.com");
await page.fill("input[type=password]", "demo1234");
await page.click("button[type=submit]");
await page.waitForURL("**/", { timeout: 15000 });
await page.waitForFunction(() => !document.body.innerText.includes("Loading"), { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(800);
await page.screenshot({ path: "screenshots/mobile_dashboard.png" });
console.log("mobile dashboard captured");

// Fakra detail
await page.goto("http://localhost:5173/fakras/8");
await page.waitForLoadState("networkidle");
await page.waitForFunction(() => !document.body.innerText.includes("Loading"), { timeout: 12000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.screenshot({ path: "screenshots/mobile_fakra_detail.png", fullPage: true });
console.log("mobile fakra detail captured");

await browser.close();
