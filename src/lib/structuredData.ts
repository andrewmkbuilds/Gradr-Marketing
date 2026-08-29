/**
 * Central JSON-LD builders.
 *
 * Every structured-data block on a public page is produced here so the shape
 * stays consistent and can be validated automatically (see
 * src/test/structuredData.test.ts).
 */
import type { Guide, GuideFaq } from "@/content/guides";
import type { BlogPost } from "@/content/blogPosts";
import type { JobLanding } from "@/content/jobLandings";
import { jobLandingFaqs } from "@/content/jobLandings";

export const SITE_NAME = "Gradr";
export const SITE_ORIGIN = "https://gradr.me";
export const OG_IMAGE = `${SITE_ORIGIN}/og.png`;

export type JsonLd = Record<string, unknown>;

import { DISCORD_URL, INSTAGRAM_URL } from "@/config/social";

const publisher = {
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_ORIGIN,
  logo: { "@type": "ImageObject", url: `${SITE_ORIGIN}/gradr-logo.png` },
  sameAs: [INSTAGRAM_URL],
};

export function absoluteUrl(path: string): string {
  return `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildArticleLd(input: {
  path: string;
  headline: string;
  description: string;
  published: string;
  updated?: string;
  keywords?: string[];
}): JsonLd {
  const url = absoluteUrl(input.path);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.headline,
    description: input.description,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    image: [OG_IMAGE],
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_ORIGIN },
    publisher,
    datePublished: input.published,
    dateModified: input.updated ?? input.published,
    inLanguage: "en",
    ...(input.keywords?.length ? { keywords: input.keywords.join(", ") } : {}),
  };
}

export function buildFaqLd(faqs: GuideFaq[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

export function buildBreadcrumbLd(trail: { name: string; path: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function buildItemListLd(input: {
  name: string;
  items: { name: string; path: string }[];
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: input.name,
    numberOfItems: input.items.length,
    itemListElement: input.items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  };
}

export function buildCollectionPageLd(input: {
  path: string;
  name: string;
  description: string;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_ORIGIN },
    inLanguage: "en",
  };
}

/** Full JSON-LD payload for one career advice guide page. */
export function guideJsonLd(guide: Guide): JsonLd[] {
  const path = `/career-advice/${guide.slug}`;
  return [
    buildArticleLd({
      path,
      headline: guide.metaTitle,
      description: guide.description,
      published: guide.published,
      updated: guide.updated,
      keywords: [guide.keyword, guide.category.toLowerCase()],
    }),
    buildFaqLd(guide.faqs),
    buildBreadcrumbLd([
      { name: "Home", path: "/" },
      { name: "Career advice", path: "/career-advice" },
      { name: guide.title, path },
    ]),
  ];
}

/** Full JSON-LD payload for one job landing page. */
export function jobLandingJsonLd(landing: JobLanding): JsonLd[] {
  const path = `/job-search/${landing.slug}`;
  return [
    buildCollectionPageLd({
      path,
      name: landing.title,
      description: landing.description,
    }),
    buildFaqLd(jobLandingFaqs(landing)),
    buildBreadcrumbLd([
      { name: "Home", path: "/" },
      { name: "Job search", path: "/job-search" },
      { name: landing.title, path },
    ]),
  ];
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Structural validation of a JSON-LD block. Not a full schema.org validator —
 * it enforces the invariants that actually break rich results: missing
 * @context/@type, empty required text, non-absolute URLs, and values that do
 * not survive JSON serialisation.
 */
export function validateJsonLd(node: JsonLd, label = "jsonld"): string[] {
  const errors: string[] = [];
  const at = (p: string) => `${label}${p}`;

  if (node["@context"] !== "https://schema.org") {
    errors.push(`${at("")}: @context must be "https://schema.org"`);
  }
  const type = node["@type"];
  if (typeof type !== "string" || !type) {
    errors.push(`${at("")}: missing @type`);
  }

  try {
    const round = JSON.parse(JSON.stringify(node));
    if (round === null) errors.push(`${at("")}: not serialisable`);
  } catch {
    errors.push(`${at("")}: not JSON-serialisable`);
  }

  const requireText = (value: unknown, path: string) => {
    if (typeof value !== "string" || value.trim() === "") {
      errors.push(`${at(path)}: must be a non-empty string`);
    }
  };
  const requireAbsoluteUrl = (value: unknown, path: string) => {
    if (typeof value !== "string" || !value.startsWith("https://")) {
      errors.push(`${at(path)}: must be an absolute https URL`);
    }
  };
  const isIsoDate = (value: unknown) =>
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

  switch (type) {
    case "Article": {
      requireText(node.headline, ".headline");
      requireText(node.description, ".description");
      requireAbsoluteUrl(node.url, ".url");
      if (!isIsoDate(node.datePublished)) errors.push(`${at(".datePublished")}: must be YYYY-MM-DD`);
      if (!isIsoDate(node.dateModified)) errors.push(`${at(".dateModified")}: must be YYYY-MM-DD`);
      if (
        typeof node.datePublished === "string" &&
        typeof node.dateModified === "string" &&
        Date.parse(node.dateModified) < Date.parse(node.datePublished)
      ) {
        errors.push(`${at(".dateModified")}: cannot precede datePublished`);
      }
      if ((node.headline as string)?.length > 110) {
        errors.push(`${at(".headline")}: should be 110 characters or fewer`);
      }
      const author = node.author as JsonLd | undefined;
      if (!author || typeof author["name"] !== "string") errors.push(`${at(".author")}: missing name`);
      const pub = node.publisher as JsonLd | undefined;
      if (!pub || typeof pub["name"] !== "string") errors.push(`${at(".publisher")}: missing name`);
      const image = node.image;
      if (!Array.isArray(image) || image.length === 0) errors.push(`${at(".image")}: must be a non-empty array`);
      else image.forEach((src, i) => requireAbsoluteUrl(src, `.image[${i}]`));
      break;
    }
    case "FAQPage": {
      const questions = node.mainEntity;
      if (!Array.isArray(questions) || questions.length < 2) {
        errors.push(`${at(".mainEntity")}: needs at least 2 questions`);
        break;
      }
      const seen = new Set<string>();
      questions.forEach((raw, i) => {
        const q = raw as JsonLd;
        if (q["@type"] !== "Question") errors.push(`${at(`.mainEntity[${i}]`)}: @type must be Question`);
        requireText(q.name, `.mainEntity[${i}].name`);
        const key = String(q.name ?? "").trim().toLowerCase();
        if (seen.has(key)) errors.push(`${at(`.mainEntity[${i}].name`)}: duplicate question`);
        seen.add(key);
        const answer = q.acceptedAnswer as JsonLd | undefined;
        if (!answer || answer["@type"] !== "Answer") {
          errors.push(`${at(`.mainEntity[${i}].acceptedAnswer`)}: @type must be Answer`);
        } else {
          requireText(answer.text, `.mainEntity[${i}].acceptedAnswer.text`);
          if (typeof answer.text === "string" && answer.text.trim().length < 40) {
            errors.push(`${at(`.mainEntity[${i}].acceptedAnswer.text`)}: answer is too short to be useful`);
          }
        }
      });
      break;
    }
    case "BreadcrumbList": {
      const items = node.itemListElement;
      if (!Array.isArray(items) || items.length === 0) {
        errors.push(`${at(".itemListElement")}: must be a non-empty array`);
        break;
      }
      items.forEach((raw, i) => {
        const item = raw as JsonLd;
        if (item["@type"] !== "ListItem") errors.push(`${at(`.itemListElement[${i}]`)}: @type must be ListItem`);
        if (item.position !== i + 1) errors.push(`${at(`.itemListElement[${i}].position`)}: must be ${i + 1}`);
        requireText(item.name, `.itemListElement[${i}].name`);
        requireAbsoluteUrl(item.item, `.itemListElement[${i}].item`);
      });
      break;
    }
    case "ItemList": {
      const items = node.itemListElement;
      if (!Array.isArray(items) || items.length === 0) {
        errors.push(`${at(".itemListElement")}: must be a non-empty array`);
        break;
      }
      if (node.numberOfItems !== items.length) {
        errors.push(`${at(".numberOfItems")}: must equal itemListElement length`);
      }
      items.forEach((raw, i) => {
        const item = raw as JsonLd;
        if (item["@type"] !== "ListItem") errors.push(`${at(`.itemListElement[${i}]`)}: @type must be ListItem`);
        if (item.position !== i + 1) errors.push(`${at(`.itemListElement[${i}].position`)}: must be ${i + 1}`);
        requireText(item.name, `.itemListElement[${i}].name`);
        requireAbsoluteUrl(item.url, `.itemListElement[${i}].url`);
      });
      break;
    }
    case "CollectionPage": {
      requireText(node.name, ".name");
      requireText(node.description, ".description");
      requireAbsoluteUrl(node.url, ".url");
      break;
    }
    case "HowTo": {
      requireText(node.name, ".name");
      requireText(node.description, ".description");
      requireAbsoluteUrl(node.url, ".url");
      const steps = node.step;
      if (!Array.isArray(steps) || steps.length < 2) {
        errors.push(`${at(".step")}: needs at least 2 steps`);
        break;
      }
      steps.forEach((raw, i) => {
        const step = raw as JsonLd;
        if (step["@type"] !== "HowToStep") errors.push(`${at(`.step[${i}]`)}: @type must be HowToStep`);
        if (step.position !== i + 1) errors.push(`${at(`.step[${i}].position`)}: must be ${i + 1}`);
        requireText(step.name, `.step[${i}].name`);
        requireText(step.text, `.step[${i}].text`);
      });
      break;
    }
    case "DefinedTermSet": {
      requireText(node.name, ".name");
      requireText(node.description, ".description");
      requireAbsoluteUrl(node.url, ".url");
      const terms = node.hasDefinedTerm;
      if (!Array.isArray(terms) || terms.length === 0) {
        errors.push(`${at(".hasDefinedTerm")}: must be a non-empty array`);
        break;
      }
      terms.forEach((raw, i) => {
        const term = raw as JsonLd;
        if (term["@type"] !== "DefinedTerm") errors.push(`${at(`.hasDefinedTerm[${i}]`)}: @type must be DefinedTerm`);
        requireText(term.name, `.hasDefinedTerm[${i}].name`);
        requireText(term.description, `.hasDefinedTerm[${i}].description`);
      });
      break;
    }
    case "SoftwareApplication": {
      requireText(node.name, ".name");
      requireText(node.description, ".description");
      requireAbsoluteUrl(node.url, ".url");
      requireText(node.applicationCategory, ".applicationCategory");
      break;
    }
    default:
      break;
  }

  return errors;
}


/** HowTo block for step-by-step landing pages (rich-result eligible). */
export function buildHowToLd(input: {
  name: string;
  description: string;
  path: string;
  steps: { name: string; text: string }[];
}): JsonLd {
  const url = absoluteUrl(input.path);
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: input.name,
    description: input.description,
    url,
    inLanguage: "en",
    step: input.steps.map((step, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: step.name,
      text: step.text,
      url: `${url}#step-${i + 1}`,
    })),
  };
}

/**
 * Machine-readable rubric for pages that publish a scoring table. Modelled as
 * a DefinedTermSet so each scoring dimension keeps its own name/description
 * instead of being flattened into prose.
 */
export function buildScoringTableLd(input: {
  name: string;
  description: string;
  path: string;
  terms: { name: string; description: string }[];
}): JsonLd {
  const url = absoluteUrl(input.path);
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: input.name,
    description: input.description,
    url,
    inLanguage: "en",
    hasDefinedTerm: input.terms.map((term) => ({
      "@type": "DefinedTerm",
      name: term.name,
      description: term.description,
      inDefinedTermSet: url,
    })),
  };
}

/** Throwing variant used in development to surface schema drift early. */
export function assertValidJsonLd(nodes: JsonLd[], label: string) {
  const errors = nodes.flatMap((n, i) => validateJsonLd(n, `${label}[${i}]`));
  if (errors.length) throw new Error(`Invalid JSON-LD:\n${errors.join("\n")}`);
}

/** Full JSON-LD payload for one blog post. */
export function blogPostJsonLd(post: BlogPost): JsonLd[] {
  const path = `/blog/${post.slug}`;
  return [
    {
      ...buildArticleLd({
        path,
        headline: post.metaTitle,
        description: post.description,
        published: post.published,
        updated: post.updated,
        keywords: [post.keyword],
      }),
      about: post.about.map((name) => ({ "@type": "Thing", name })),
    },
    buildFaqLd(post.faqs),
    buildBreadcrumbLd([
      { name: "Home", path: "/" },
      { name: post.title, path },
    ]),
  ];
}

/* -------------------------------------------------------------------------- */
/* Legal pages                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * WebPage JSON-LD for a policy page (/terms, /privacy, /cookie-policy, /dpa,
 * /refund-policy). Google does not render a dedicated rich result for policy
 * text, but the explicit WebPage + publisher + dateModified block is what lets
 * it attribute the document to the Gradr entity and show accurate sitelinks.
 */
export function buildLegalWebPageLd(input: {
  path: string;
  name: string;
  description: string;
  lastUpdated: string;
}): JsonLd {
  const url = absoluteUrl(input.path);
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: input.name,
    description: input.description,
    url,
    dateModified: input.lastUpdated,
    inLanguage: "en",
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_ORIGIN },
    publisher,
    about: { "@type": "Organization", name: SITE_NAME, url: SITE_ORIGIN },
  };
}

/** Full JSON-LD payload for one legal page: WebPage + breadcrumb trail. */
export function legalJsonLd(input: {
  path: string;
  name: string;
  description: string;
  lastUpdated: string;
}): JsonLd[] {
  return [
    buildLegalWebPageLd(input),
    buildBreadcrumbLd([
      { name: "Home", path: "/" },
      { name: "Legal", path: "/terms" },
      { name: input.name, path: input.path },
    ]),
  ];
}
