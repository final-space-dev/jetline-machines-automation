// E2E screenshot walk-through — real browser, real data (prod DBs over VPN).
// Logs in, screenshots the login (incl. password toggle), then every view.
// Captures console errors + failed requests per page. NO assertions about
// "correctness" — the screenshots are the evidence; the human judges them.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const BASE = 'http://localhost:3010';
const OUT = '/private/tmp/claude-501/-Users-alwynkotze-Documents-JDW-jetline-machines-automation/52d667b0-e605-4e30-9062-90b31fd48b80/scratchpad/shots';
mkdirSync(OUT, { recursive: true });

const ADMIN = { email: 'admin@jetline.local', password: 'JetlineFleet2026!' };

// Every view worth seeing, in nav order. [slug, path, waitHint]
const VIEWS = [
  ['stores',            '/equipment'],
  ['fleet-health',      '/equipment/fleet'],
  ['models-catalogue',  '/equipment/models'],
  ['operations',        '/operations'],
  ['activity',          '/activity'],
  ['machine-reports',   '/machine-reports'],
  ['machine-mapping',   '/machine-mapping'],
  ['setup-equipment-types', '/setup/equipment-types'],
  ['setup-conditions',  '/setup/conditions'],
  ['setup-models',      '/setup/models'],
  ['setup-store-groups','/setup/store-groups'],
  ['setup-connections', '/setup/connections'],
  ['setup-users',       '/setup/users'],
  ['reports-data-quality', '/reports/data-quality'],
  ['account',           '/account'],
];

const report = [];

function attachConsole(page, bucket) {
  page.on('console', m => { if (m.type() === 'error') bucket.consoleErrors.push(m.text().slice(0, 300)); });
  page.on('pageerror', e => bucket.pageErrors.push(String(e).slice(0, 300)));
  page.on('requestfailed', r => bucket.failedRequests.push(`${r.method()} ${r.url().replace(BASE,'')} — ${r.failure()?.errorText||''}`.slice(0,200)));
  page.on('response', r => { if (r.status() >= 400) bucket.badResponses.push(`${r.status()} ${r.url().replace(BASE,'')}`.slice(0,200)); });
}
const newBucket = (name, path) => ({ name, path, consoleErrors: [], pageErrors: [], failedRequests: [], badResponses: [] });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// ---- LOGIN PAGE (before auth) ----
{
  const b = newBucket('login', '/login'); attachConsole(page, b);
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' }).catch(()=>{});
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/00-login.png`, fullPage: true });
  // type a password and toggle show/hide to capture the eye toggle
  await page.fill('#email', ADMIN.email).catch(()=>{});
  await page.fill('#password', ADMIN.password).catch(()=>{});
  await page.screenshot({ path: `${OUT}/00b-login-typed.png`, fullPage: true });
  const eye = page.locator('button[aria-label*="password" i]').first();
  if (await eye.count()) { await eye.click().catch(()=>{}); await page.waitForTimeout(200); await page.screenshot({ path: `${OUT}/00c-login-shown.png`, fullPage: true }); }
  report.push(b);
}

// ---- SIGN IN (wait for real navigation off /login) ----
await Promise.all([
  page.waitForURL(u => !u.toString().includes('/login'), { timeout: 20000 }).catch(()=>{}),
  page.click('button[type="submit"]').catch(()=>{}),
]);
await page.waitForTimeout(2000);
const afterLogin = page.url();
report.push({ name: 'post-login-url', path: afterLogin, note: afterLogin.includes('/login') ? 'STILL ON LOGIN — auth failed' : 'logged in OK' });

// ---- EVERY VIEW ----
let i = 1;
for (const [slug, path] of VIEWS) {
  const b = newBucket(slug, path); attachConsole(page, b);
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) { b.pageErrors.push('NAV TIMEOUT/ERROR: ' + String(e).slice(0,160)); }
  await page.waitForTimeout(1500); // let client fetches settle
  // detect stuck "Loading" states
  const bodyText = (await page.textContent('body').catch(()=> '') || '').slice(0, 4000);
  b.stuckLoading = /loading (users|stores|equipment|data|models|report)/i.test(bodyText);
  b.looksEmpty = bodyText.replace(/\s+/g,' ').trim().length < 400;
  await page.screenshot({ path: `${OUT}/${String(i).padStart(2,'0')}-${slug}.png`, fullPage: true }).catch(()=>{});
  report.push(b);
  i++;
}

await browser.close();

// ---- write a concise defect summary ----
const lines = [];
for (const r of report) {
  const issues = [];
  if (r.note) issues.push(r.note);
  if (r.stuckLoading) issues.push('STUCK ON LOADING');
  if (r.looksEmpty) issues.push('PAGE LOOKS EMPTY (<400 chars)');
  if (r.pageErrors?.length) issues.push(`pageErrors: ${r.pageErrors.length}`);
  if (r.consoleErrors?.length) issues.push(`consoleErrors: ${r.consoleErrors.length}`);
  if (r.badResponses?.length) issues.push(`badResp: ${r.badResponses.join(' | ')}`);
  if (r.failedRequests?.length) issues.push(`failedReq: ${r.failedRequests.join(' | ')}`);
  lines.push(`${(r.name||'?').padEnd(22)} ${r.path||''}\n   ${issues.length ? issues.join('  ·  ') : 'no captured errors'}`);
  if (r.pageErrors?.length) r.pageErrors.forEach(e => lines.push('     ! ' + e));
  if (r.consoleErrors?.length) r.consoleErrors.slice(0,4).forEach(e => lines.push('     · ' + e));
}
writeFileSync(`${OUT}/_defects.txt`, lines.join('\n'));
console.log(lines.join('\n'));
console.log('\nScreenshots in: ' + OUT);
