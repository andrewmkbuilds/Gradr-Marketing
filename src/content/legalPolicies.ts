/**
 * Bundled v1 of the Gradr standalone policy documents that sit alongside the
 * Terms, Privacy Notice, Cookie Policy and DPA:
 *
 * - Acceptable Use Policy
 * - AI Usage & AI Disclaimer
 * - Disclaimer & Limitation of Liability
 * - Affiliate Disclosure
 *
 * Same markdown subset as `legalDocs.ts` (`## heading`, `- bullet`,
 * paragraphs, `**bold**`, `[label](href)`).
 *
 * IMPORTANT: nothing in this file may invent a legal entity, registration
 * number, address, tax number, certification or compliance status. Business
 * identity that is not yet confirmed lives in `COMPANY_IDENTITY` below and is
 * rendered as an explicit "to be provided" row, never as an invented value.
 */
import {
  REFUND_WINDOW_DAYS,
  SELLER_CONTACT_EMAIL,
  SELLER_LEGAL_NAME,
  SELLER_TRADING_NAME,
  SELLER_WEBSITE_URL,
} from "./legal";

export const POLICIES_V1_EFFECTIVE = "2026-08-26";

/**
 * Business identity surfaced on the /legal page. `value: null` means the owner
 * has not supplied a verified value yet — the UI shows a clearly marked
 * "Not yet provided" state instead of a placeholder that could be mistaken for
 * a real registration detail.
 */
export const COMPANY_IDENTITY: { label: string; value: string | null; note?: string }[] = [
  { label: "Trading name", value: SELLER_TRADING_NAME },
  { label: "Website", value: SELLER_WEBSITE_URL },
  { label: "Support contact", value: SELLER_CONTACT_EMAIL },
  { label: "Privacy contact", value: SELLER_CONTACT_EMAIL, note: "Dedicated privacy@ mailbox pending" },
  { label: "Legal contact", value: SELLER_CONTACT_EMAIL, note: "Dedicated legal@ mailbox pending" },
  { label: "Registered legal entity name", value: null },
  { label: "Company registration number", value: null },
  { label: "Registered business address", value: null },
  { label: "Country of establishment / governing law", value: null },
  { label: "VAT / tax registration", value: null, note: "Paddle acts as Merchant of Record and handles sales tax/VAT on orders" },
  { label: "Data Protection Officer", value: null, note: "Only required if a DPO appointment is legally triggered" },
  { label: "EU / UK representative (Art. 27 GDPR)", value: null, note: "Required only if established outside the EU/UK and targeting those users" },
];

export const ACCEPTABLE_USE_V1 = `## 1. Scope

This Acceptable Use Policy applies to everyone who uses Gradr at ${SELLER_WEBSITE_URL} or the Gradr application. It forms part of our [Terms & Conditions](/terms). Where this policy and the Terms overlap, both apply.

## 2. Use Gradr for your own career

Gradr is a personal career workspace. Accounts are individual and non-transferable. You may use Gradr to work on your own applications, resumes, interviews and job search.

## 3. Prohibited conduct

You must not:

- Upload content you do not have the right to share, including another person's resume, confidential employer material, or documents containing other people's personal data without a lawful basis.
- Misrepresent your identity, employment history, education or qualifications in material you generate with Gradr and send to an employer.
- Use Gradr to harass, defame, threaten, discriminate against or impersonate anyone.
- Upload malware, run automated abuse, or attempt to bypass authentication, entitlement limits, usage metering, rate limits or any other security control.
- Scrape, crawl, resell, mirror or systematically extract Gradr content, job listings or AI output.
- Reverse engineer the Service, probe it for vulnerabilities without written permission, or interfere with its availability for others.
- Use the Service, its output or its prompts to build, train or benchmark a competing product.
- Record, transcribe or analyse an identifiable third party in an interview session without their consent.
- Use Gradr for anything unlawful in your jurisdiction or ours.

## 4. Automated and high-volume use

Automated access, headless clients, shared accounts and credential sharing are not permitted. Entitlements described as "unlimited" remain subject to fair use and anti-abuse limits; we may throttle or pause usage that is materially out of line with normal individual use.

## 5. AI-specific rules

- Do not attempt to make the AI produce unlawful, hateful, sexual, or deliberately deceptive content.
- Do not present AI output as verified fact about a person or employer.
- Do not use AI interview transcripts to make employment decisions about someone else — Gradr is a practice tool, not an assessment platform.

## 6. Reporting abuse

Report suspected abuse, security issues or content problems to ${SELLER_CONTACT_EMAIL}. Please include enough detail for us to reproduce or locate the issue.

## 7. Enforcement

Depending on severity we may warn you, remove content, restrict a feature, suspend your account, terminate access, or report the matter to the relevant authorities. Where reasonable we will contact you first. Suspension for breach does not create a refund entitlement beyond what the [Refund Policy](/refund-policy) and applicable consumer law require.`;

export const AI_DISCLAIMER_V1 = `## 1. Gradr is an AI-assisted product

Substantial parts of Gradr are powered by artificial intelligence, including large language models and speech models operated by third-party providers. This notice explains what that means in practice. It supplements the [Terms & Conditions](/terms) and the [Privacy Notice](/privacy).

## 2. Where AI is used

- **Resume and CV analysis.** Uploaded documents are parsed and scored. Scores combine deterministic checks with AI-generated commentary and rewrite suggestions.
- **ATS and match scoring.** ATS readiness scores and job-match percentages are heuristics computed by Gradr. They are estimates of how a document may be read, not results from any employer's real applicant tracking system.
- **Generated application materials.** Cover letters, summaries, bullet rewrites and outreach drafts are machine-generated first drafts.
- **AI mock interviews.** Interview sessions are simulations run by a conversational AI model. Audio from your microphone is streamed to the AI voice provider in real time to run the conversation. Transcripts, scores and feedback reports are generated automatically.
- **Career guidance and recommendations.** Skill-gap analysis, role suggestions, practice plans and next-step recommendations are generated from the data available to us at that moment.

## 3. Limitations you should assume

AI output can be incomplete, outdated, biased, or simply wrong, and can state incorrect things confidently. It can also vary between runs for the same input.

- Scores, percentages and readiness signals are **not** guarantees of how any employer, recruiter or applicant tracking system will treat you.
- Job market, salary and employer information may be stale or inaccurate.
- Interview questions and feedback do not represent any real employer, recruiter or hiring process.
- Gradr does not provide legal, immigration, financial, medical or professional career-counselling advice.

**We make no claim that using Gradr will result in interviews, offers or employment, and we do not promise any level of ATS pass rate or success rate.**

## 4. You stay responsible

You must review, verify and edit anything Gradr generates before you rely on it or send it to an employer. You remain solely responsible for the accuracy and truthfulness of everything you submit under your own name, and for any decision you make based on Gradr output.

## 5. Third-party AI processing

To deliver these features, the content you submit — including resume text, job descriptions, notes and live interview audio — is transmitted to third-party model providers acting as our processors. The current categories of provider and the safeguards we rely on are described in the [Privacy Notice](/privacy) and the [Data Processing Addendum](/dpa).

We do not use your resumes, transcripts or other content to train our own foundation models, and we do not sell personal data.

## 6. Human oversight and reporting problems

There is no automated decision-making in Gradr that produces a legal or similarly significant effect on you: Gradr does not decide whether you get a job, and does not send anything to an employer on your behalf without your action. If you believe AI output about you is inaccurate or harmful, contact ${SELLER_CONTACT_EMAIL} and we will look into it.

## 7. Camera and microphone

Interview features use your microphone, and optionally your camera, only while a session is running and only after you grant browser permission. Camera-based presence and engagement signals are computed in your browser; camera video is not uploaded or stored. You can revoke permission at any time in your browser settings.`;

export const DISCLAIMER_V1 = `## 1. General information only

Everything published on ${SELLER_WEBSITE_URL} and produced inside Gradr — guides, articles, templates, scores, recommendations and AI output — is general information for your own career use. It is not legal, immigration, financial, tax, medical or professional career-counselling advice, and it is not a substitute for advice from a qualified professional who knows your circumstances.

## 2. No outcome guarantee

We do not guarantee interviews, offers, salary outcomes, employment, visa outcomes, or that any document will pass a specific applicant tracking system or recruiter screen. Any example, testimonial or figure shown on the site is illustrative of what some users experience and is not a promise of your result.

## 3. Third-party content

Job listings, employer details, salary figures and links to third-party sites are provided by external sources. We do not control, verify, endorse or guarantee them, and we are not responsible for the content, practices or availability of any third-party site or employer. Verify a role and an employer before sharing personal data with them.

## 4. Availability

The Service is provided "as is" and "as available". We do not offer a contractual uptime guarantee. Maintenance, third-party outages and model provider incidents can interrupt access.

## 5. Limitation of liability

To the maximum extent permitted by law, ${SELLER_LEGAL_NAME} is not liable for indirect, incidental, special, consequential or punitive damages, or for lost profits, lost opportunities, lost employment, or lost or corrupted data.

Our total aggregate liability arising out of or relating to the Service is limited to the greater of the amounts you paid us in the twelve months before the event giving rise to the claim, or USD 100.

Nothing in this notice or in our [Terms & Conditions](/terms) excludes or limits liability for fraud, for death or personal injury caused by negligence, or for any other liability that cannot lawfully be excluded. If you are a consumer, your mandatory statutory rights are unaffected.

## 6. Contact

Questions about this notice: ${SELLER_CONTACT_EMAIL}.`;

export const AFFILIATE_DISCLOSURE_V1 = `## 1. Gradr runs an affiliate programme

Gradr operates a referral/affiliate programme. Approved affiliates receive a tracking link and earn a commission on qualifying, completed and non-refunded purchases attributed to that link within the attribution window shown in the programme terms.

## 2. What this means for you as a buyer

- The price you pay is exactly the same whether or not you arrive through an affiliate link. Affiliates are paid out of our margin.
- Clicking an affiliate link stores a referral identifier so the referring affiliate can be credited. That identifier is described in our [Cookie Policy](/cookie-policy) and [Privacy Notice](/privacy).
- An affiliate is an independent third party. Their opinions, claims and content are their own and are not reviewed or endorsed by us before publication.

## 3. Rules affiliates must follow

Affiliates must disclose their relationship with Gradr clearly and prominently wherever they promote us, in line with the advertising and endorsement rules that apply where they and their audience are located (for example the US FTC endorsement guides and equivalent UK/EU/UAE advertising rules).

Affiliates must not:

- Claim or imply that Gradr guarantees a job, an interview, or a specific ATS or success rate.
- Invent testimonials, results, statistics or certifications.
- Use self-referrals, incentivised or fraudulent clicks, cookie stuffing, or spam.
- Bid on Gradr brand terms in paid search, or impersonate Gradr in ads, email or social profiles.

Breach voids commissions and can end the affiliate account. Refunded or reversed transactions are clawed back.

## 4. Outbound links on gradr.me

Where a page on ${SELLER_WEBSITE_URL} links to a third-party product under a commercial arrangement, we label it on that page. Unlabelled outbound links are editorial and earn us nothing.

## 5. Refunds

Purchases made through an affiliate link are covered by the same [Refund Policy](/refund-policy), including the ${REFUND_WINDOW_DAYS}-day window. Paddle remains the Merchant of Record for every order.

## 6. Contact

Programme questions: ${SELLER_CONTACT_EMAIL}.`;
