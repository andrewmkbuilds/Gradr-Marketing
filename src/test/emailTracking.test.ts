import { describe, expect, it } from "vitest";
import { withEngagementTracking } from "../../supabase/functions/_shared/emailTracking";

const MESSAGE_ID = "abcd1234-abcd-1234-abcd-123456789012";
const BASE = "https://project.supabase.co";

const wrap = (body: string) => `<html><body>${body}</body></html>`;

describe("withEngagementTracking", () => {
  it("adds a single open pixel inside the body", () => {
    const html = withEngagementTracking(wrap("<p>hi</p>"), MESSAGE_ID, BASE);
    const pixels = html.match(/t=open/g) ?? [];
    expect(pixels).toHaveLength(1);
    expect(html.indexOf("t=open")).toBeLessThan(html.indexOf("</body>"));
  });

  it("wraps gradr.me links for click tracking", () => {
    const html = withEngagementTracking(
      wrap('<a href="https://gradr.me/career-advice">Read</a>'),
      MESSAGE_ID,
      BASE,
    );
    expect(html).toContain("email-track?m=");
    expect(html).toContain("u=https%3A%2F%2Fgradr.me%2Fcareer-advice");
  });

  it("leaves unsubscribe, confirmation and tokenised links untouched", () => {
    for (const href of [
      "https://gradr.me/unsubscribe?token=abc",
      "https://gradr.me/newsletter/confirm?token=abc",
      "https://gradr.me/anything?token=abc",
    ]) {
      const html = withEngagementTracking(wrap(`<a href="${href}">Go</a>`), MESSAGE_ID, BASE);
      expect(html).toContain(`href="${href}"`);
    }
  });

  it("leaves off-brand and mailto links untouched", () => {
    const html = withEngagementTracking(
      wrap('<a href="https://evil.example.com/">x</a><a href="mailto:support@gradr.me">mail</a>'),
      MESSAGE_ID,
      BASE,
    );
    expect(html).toContain('href="https://evil.example.com/"');
    expect(html).toContain('href="mailto:support@gradr.me"');
  });

  it("returns the html unchanged when tracking context is missing", () => {
    const html = wrap('<a href="https://gradr.me/">home</a>');
    expect(withEngagementTracking(html, "", BASE)).toBe(html);
    expect(withEngagementTracking(html, MESSAGE_ID, "")).toBe(html);
  });
});
