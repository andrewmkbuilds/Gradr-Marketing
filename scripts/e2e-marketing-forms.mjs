#!/usr/bin/env node
/**
 * End-to-end tests for every form on the marketing surface.
 *
 * Each form is exercised through all three of the states a visitor can hit —
 * loading, success and error — with the backend stubbed so the assertions are
 * deterministic and no real email is ever sent.
 *
 *   node scripts/e2e-marketing-forms.mjs [baseUrl]
 */
import { launchChromium } from "./lib/browser.mjs";
import { MARKETING_ORIGIN, resolveBase, serveUnderProductionHosts } from "./lib/marketingSurface.mjs";

const BASE = resolveBase();
const SUPPORT_ORIGIN = "https://support.gradr.me";

const results = [];
const failures = [];

async function step(name, fn) {
  try {
    await fn();
    results.push(name);
    console.log(`✓ ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.log(`✖ ${name} — ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** Stub a Supabase edge function with an optional delay and status. */
async function stubFunction(page, name, { body, status = 200, delayMs = 0 } = {}) {
  await page.route(`**/functions/v1/${name}*`, async (route) => {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    await route.fulfill({
      status,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(body ?? {}),
    });
  });
}

const browser = await launchChromium();
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
  await serveUnderProductionHosts(context, BASE, [MARKETING_ORIGIN, SUPPORT_ORIGIN]);

  // ---------------------------------------------------------------- newsletter
  const newsletterForm = async (page) => {
    await page.goto(`${MARKETING_ORIGIN}/`, { waitUntil: "domcontentloaded" });
    // Reveal wrappers mount their children after hydration: wait for the page
    // to settle so the locator does not detach mid-action.
    await page.waitForLoadState("load").catch(() => {});
    await page.waitForTimeout(1600);
    const email = page.locator('input[type="email"]').first();
    await email.scrollIntoViewIfNeeded({ timeout: 5000 });
    // Match by role+type, not by label: the label flips to "Subscribing…" while
    // the request is in flight.
    return { email, submit: page.locator('form button[type="submit"]').first() };
  };

  await step("newsletter: invalid email shows a field error and calls nothing", async () => {
    const page = await context.newPage();
    let called = false;
    await page.route("**/functions/v1/newsletter-subscribe*", (route) => {
      called = true;
      route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    const { email, submit } = await newsletterForm(page);
    await email.fill("not-an-email");
    await submit.click();
    await page.waitForTimeout(400);
    await page.getByText(/Enter a valid email address/i).first().waitFor({ timeout: 4000 });
    assert(!called, "the backend was called for an invalid address");
    await page.close();
  });

  await step("newsletter: loading state disables submit while in flight", async () => {
    const page = await context.newPage();
    await stubFunction(page, "newsletter-subscribe", { body: { ok: true }, delayMs: 1500 });
    const { email, submit } = await newsletterForm(page);
    await email.fill("loading@example.com");
    await submit.click();
    await page.waitForTimeout(300);
    await page.getByText(/Subscribing…/).first().waitFor({ timeout: 3000 });
    assert(await submit.isDisabled(), "submit stayed enabled during the request");
    await page.close();
  });

  await step("newsletter: success shows the double opt-in confirmation", async () => {
    const page = await context.newPage();
    await stubFunction(page, "newsletter-subscribe", { body: { ok: true } });
    const { email, submit } = await newsletterForm(page);
    await email.fill("success@example.com");
    await submit.click();
    await page.getByText(/Check your inbox/i).first().waitFor({ timeout: 6000 });
    await page.getByText(/success@example\.com/).first().waitFor({ timeout: 3000 });
    await page.close();
  });

  await step("newsletter: backend error surfaces a message and re-enables submit", async () => {
    const page = await context.newPage();
    await stubFunction(page, "newsletter-subscribe", {
      status: 500,
      body: { error: "Too many signups from this network. Try again later." },
    });
    const { email, submit } = await newsletterForm(page);
    await email.fill("error@example.com");
    await submit.click();
    await page.getByText(/could not sign you up|Too many signups/i).first().waitFor({ timeout: 6000 });
    assert(!(await submit.isDisabled()), "submit stayed disabled after the failure");
    await page.close();
  });

  // ------------------------------------------------------- newsletter confirm
  await step("newsletter confirm: valid token confirms the subscription", async () => {
    const page = await context.newPage();
    await stubFunction(page, "newsletter-subscribe", { body: { confirmed: true } });
    await page.goto(`${MARKETING_ORIGIN}/newsletter/confirm?token=valid`, { waitUntil: "domcontentloaded" });
    await page.getByText(/You're subscribed/i).first().waitFor({ timeout: 8000 });
    await page.close();
  });

  await step("newsletter confirm: expired token explains the failure", async () => {
    const page = await context.newPage();
    await stubFunction(page, "newsletter-subscribe", {
      status: 400,
      body: { error: "This confirmation link has expired." },
    });
    await page.goto(`${MARKETING_ORIGIN}/newsletter/confirm?token=expired`, { waitUntil: "domcontentloaded" });
    await page.getByText(/could not confirm this link/i).first().waitFor({ timeout: 8000 });
    await page.close();
  });

  await step("newsletter confirm: missing token is rejected before any request", async () => {
    const page = await context.newPage();
    let called = false;
    await page.route("**/functions/v1/newsletter-subscribe*", (route) => {
      called = true;
      route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    await page.goto(`${MARKETING_ORIGIN}/newsletter/confirm`, { waitUntil: "domcontentloaded" });
    await page.getByText(/could not confirm this link/i).first().waitFor({ timeout: 8000 });
    assert(!called, "a request was made without a token");
    await page.close();
  });

  // ------------------------------------------------------------- unsubscribe
  await step("unsubscribe: valid token → confirm → success state", async () => {
    const page = await context.newPage();
    await stubFunction(page, "handle-email-unsubscribe", {
      body: { valid: true, email: "reader@example.com", success: true },
    });
    await page.goto(`${MARKETING_ORIGIN}/unsubscribe?token=valid`, { waitUntil: "domcontentloaded" });
    await page.getByText(/Unsubscribe from Gradr emails\?/i).first().waitFor({ timeout: 8000 });
    await page.getByRole("button", { name: /Confirm unsubscribe/i }).click();
    await page.getByText(/You've been unsubscribed/i).first().waitFor({ timeout: 8000 });
    await page.close();
  });

  await step("unsubscribe: already-unsubscribed token is handled", async () => {
    const page = await context.newPage();
    await stubFunction(page, "handle-email-unsubscribe", {
      body: { valid: false, reason: "already_unsubscribed", email: "reader@example.com" },
    });
    await page.goto(`${MARKETING_ORIGIN}/unsubscribe?token=used`, { waitUntil: "domcontentloaded" });
    await page.getByText(/already unsubscribed/i).first().waitFor({ timeout: 8000 });
    await page.close();
  });

  await step("unsubscribe: network failure shows the error state", async () => {
    const page = await context.newPage();
    await page.route("**/functions/v1/handle-email-unsubscribe*", (route) => route.abort());
    await page.goto(`${MARKETING_ORIGIN}/unsubscribe?token=boom`, { waitUntil: "domcontentloaded" });
    await page.getByText(/Something went wrong|isn't valid/i).first().waitFor({ timeout: 8000 });
    await page.close();
  });

  await step("unsubscribe: missing token renders the invalid-link state", async () => {
    const page = await context.newPage();
    await page.goto(`${MARKETING_ORIGIN}/unsubscribe`, { waitUntil: "domcontentloaded" });
    await page.getByText(/isn't valid/i).first().waitFor({ timeout: 8000 });
    await page.close();
  });

  // --------------------------------------------------------- support contact
  await step("support contact: required fields block an empty submit", async () => {
    const page = await context.newPage();
    await page.goto(`${SUPPORT_ORIGIN}/contact`, { waitUntil: "domcontentloaded" });
    await page.locator("#support-subject").waitFor({ timeout: 8000 });
    await page.getByRole("button", { name: /Send message/i }).click();
    await page.waitForTimeout(300);
    const valid = await page.locator("#support-subject").evaluate((el) => el.checkValidity());
    assert(!valid, "the empty subject field reported itself as valid");
    await page.close();
  });

  await step("support contact: filled form composes a mailto to support", async () => {
    const page = await context.newPage();
    // `window.location` is unforgeable, so the hand-off is observed as the
    // mailto: request Chromium emits when the app assigns it.
    const mailtos = [];
    page.on("request", (req) => {
      if (req.url().startsWith("mailto:")) mailtos.push(req.url());
    });
    await page.goto(`${SUPPORT_ORIGIN}/contact`, { waitUntil: "domcontentloaded" });
    await page.locator("#support-subject").waitFor({ timeout: 8000 });
    await page.fill("#support-subject", "Billing question");
    await page.fill("#support-message", "My invoice looks wrong.");
    await page.getByRole("button", { name: /Send message/i }).click();
    await page.waitForTimeout(800);
    const mailto = mailtos[0];
    assert(mailto, "no mailto hand-off was composed");
    assert(mailto.startsWith("mailto:support@gradr.me"), `mailto went to the wrong inbox: ${mailto}`);
    assert(/subject=Billing%20question/.test(mailto), "the subject was not carried into the mailto");
    assert(/invoice/i.test(decodeURIComponent(mailto)), "the message body was not carried into the mailto");
    await page.close();
  });

  await context.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n✖ ${failures.length} of ${results.length + failures.length} form check(s) failed:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\n✓ All ${results.length} marketing form flows pass (loading, success and error states).`);
