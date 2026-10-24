import { chromium } from "playwright";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
  args: [
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("http://127.0.0.1:8767/", {
    waitUntil: "load",
    timeout: 120000,
  });
  await page.waitForFunction(() => window.__qingming?.frames >= 2, null, {
    timeout: 120000,
  });
  await page.screenshot({
    path: new URL("../preview.png", import.meta.url).pathname,
    timeout: 120000,
  });
  console.log(
    JSON.stringify(
      {
        errors,
        state: await page.evaluate(() => ({
          ...window.__qingming,
          people: window.__qingming.people.length,
          boats: window.__qingming.boats.length,
        })),
      },
      null,
      2,
    ),
  );
  await page.getByRole("button", { name: "虹桥", exact: true }).click();
  await page.waitForFunction(() => window.__qingming?.camera[0] < 10, null, {
    timeout: 120000,
  });
  await page.screenshot({
    path: new URL("../bridge-preview.png", import.meta.url).pathname,
    timeout: 120000,
  });
  console.log("Bridge screenshot saved");
} finally {
  await browser.close();
}
