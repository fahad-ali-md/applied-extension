const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  await page.goto('http://localhost:5173/options.html');
  await page.screenshot({ path: '/tmp/options.png', fullPage: true });
  await browser.close();
})();
