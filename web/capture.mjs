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
  await page.fill("input[type=email]", "demo@fakerni.com");
  await page.fill("input[type=password]", "demo1234");
  await page.click("button[type=submit]");
  await page.waitForURL("**/", { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  // wait for Loading... text to go away
  await page.waitForFunction(() => !document.body.innerText.includes("Loading…"), { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: "screenshots/web_dashboard.png" });
  console.log("dashboard captured");

  // Grab all links to find a fakra
  const links = await page.locator("a").all();
  let fakraLink = null;
  for (const l of links) {
    const href = await l.getAttribute("href");
    if (href && href.includes("/fakras/")) { fakraLink = l; break; }
  }
  // Navigate directly to fakra 8 (Weekly Groceries, 5 items)
  await page.goto("http://localhost:5173/fakras/8");
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(
    () => !document.body.innerText.includes("Loading"),
    { timeout: 12000 }
  ).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "screenshots/web_fakra_detail.png", fullPage: true });
  console.log("fakra detail captured");
} catch (e) {
  console.error("login/nav failed:", e.message);
  await page.screenshot({ path: "screenshots/web_error.png" });
}

await browser.close();
