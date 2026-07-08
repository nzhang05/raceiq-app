import { chromium } from 'playwright';

const SCRATCHPAD = '/private/tmp/claude-501/-Users-nzhang-Projects-raceiq-app/c9e588fa-5da1-4990-a09e-4592da5159a9/scratchpad';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const networkLog = [];
page.on('request', req => { if (req.url().includes('open-meteo')) networkLog.push('REQ: ' + req.url().slice(0,120)); });

await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
await page.click('button:has-text("+ ADD RACE")');
await page.waitForTimeout(400);

const locationInput = page.locator('input[placeholder="Philadelphia, PA"]').first();
await locationInput.click();
await locationInput.pressSequentially('Saint-Martin', { delay: 50 });
await page.waitForTimeout(1200);

await page.screenshot({ path: `${SCRATCHPAD}/08_saint_martin_dropdown.png` });

// Click the first suggestion
const firstSuggestion = page.locator('[style*="zIndex: 999"] div, [style*="z-index: 999"] div').first();
if (await firstSuggestion.count() > 0) {
  const suggestionText = await firstSuggestion.textContent();
  console.log('Clicking suggestion:', suggestionText);
  await firstSuggestion.click();
  await page.waitForTimeout(300);
}

const inputVal = await locationInput.inputValue();
console.log('Input value after selection:', inputVal);

await page.screenshot({ path: `${SCRATCHPAD}/09_after_selection.png` });
console.log('Network requests:', networkLog);
await browser.close();
