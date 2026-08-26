import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LEGAL_PAGES } from "@/content/legal";
import { LEGAL_LAST_UPDATED, LEGAL_REGISTRY, legalEffectiveDate } from "@/content/legalRegistry";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");

const app = read("src/App.tsx");
const routeSeo = read("src/components/RouteSeo.tsx");
const sitemap = read("public/sitemap.xml");
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Every published policy page must stay wired end to end: registry metadata,
 * an effective date, a route, SEO metadata and a sitemap entry with a lastmod
 * that matches the document's own effective date.
 */
describe("legal registry", () => {
  it("covers every footer legal page exactly once", () => {
    expect(LEGAL_REGISTRY.map((p) => p.path)).toEqual(LEGAL_PAGES.map((p) => p.path));
    expect(new Set(LEGAL_REGISTRY.map((p) => p.path)).size).toBe(LEGAL_REGISTRY.length);
  });

  it.each(LEGAL_REGISTRY)("$path is complete and wired", (page) => {
    expect(page.label.length).toBeGreaterThan(1);
    expect(page.description.length).toBeGreaterThan(10);
    expect(page.effective).toMatch(ISO_DATE);
    expect(app).toContain(`path="${page.path}"`);
    expect(routeSeo).toContain(`"${page.path}"`);
    expect(sitemap).toContain(`<loc>https://gradr.me${page.path}</loc>`);
  });

  it.each(LEGAL_REGISTRY)("$path publishes its effective date as sitemap lastmod", (page) => {
    const block = sitemap.split(`<loc>https://gradr.me${page.path}</loc>`)[1]?.split("</url>")[0] ?? "";
    expect(block).toContain(`<lastmod>${legalEffectiveDate(page.path)}</lastmod>`);
  });

  it("exposes the /legal hub with the newest policy date", () => {
    expect(LEGAL_LAST_UPDATED).toMatch(ISO_DATE);
    const dates = LEGAL_REGISTRY.map((p) => p.effective).sort();
    expect(LEGAL_LAST_UPDATED).toBe(dates[dates.length - 1]);
    expect(sitemap).toContain("<loc>https://gradr.me/legal</loc>");
  });

  it("keeps no effective date in the future", () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const page of LEGAL_REGISTRY) {
      expect(page.effective <= today).toBe(true);
    }
  });
});
