import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 800 });

// Login page
await page.goto("http://localhost:5173/login");
await page.waitForLoadState("networkidle");
await page.screenshot({ path: "screenshots/web_login.png" });
console.log("login page captured");

// Attempt login
try {
  await page.fill("input[type=email]", "ghassenchich@gmail.com");
  await page.fill("input[type=password]", "admin123");
  await page.click("button[type=submit]");
  await page.waitForURL("**/", { timeout: 8000 });
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "screenshots/web_dashboard.png" });
  console.log("dashboard captured");

  // Click first fakra link
  const firstFakra = page.locator("a[href*='/fakras/']").first();
  if (await firstFakra.count() > 0) {
    await firstFakra.click();
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "screenshots/web_fakra_detail.png" });
    console.log("fakra detail captured");
  } else {
    console.log("no fakras found on dashboard");
  }
} catch (e) {
  console.error("login/nav failed:", e.message);
  await page.screenshot({ path: "screenshots/web_error.png" });
}

await browser.close();
