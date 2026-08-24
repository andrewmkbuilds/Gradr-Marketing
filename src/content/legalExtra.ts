/**
 * Bundled v1 of the Gradr Cookie Policy and Data Processing Addendum (DPA).
 *
 * Same markdown subset as `legalDocs.ts` (`## heading`, `- bullet`, paragraphs,
 * `**bold**`, `[label](href)`). These pages are static bundled documents — they
 * are not versioned in the database like Terms and Privacy, because they change
 * only when the underlying processing does.
 */
import {
  SELLER_CONTACT_EMAIL,
  SELLER_DOMAIN,
  SELLER_LEGAL_NAME,
  SELLER_WEBSITE_URL,
} from "./legal";

export const COOKIE_POLICY_EFFECTIVE = "2026-08-12";
export const DPA_EFFECTIVE = "2026-08-12";

export const COOKIE_POLICY_V1 = `## 1. What this policy covers

This Cookie Policy explains how ${SELLER_LEGAL_NAME} uses cookies and similar technologies (local storage, session storage and pixels) on ${SELLER_WEBSITE_URL} and in the Gradr application. It sits alongside our [Privacy Policy](/privacy) and [Terms & Conditions](/terms).

## 2. What cookies are

Cookies are small text files a site stores on your device. Similar technologies such as browser local storage keep data in the browser itself. We use both. Some are set by us on ${SELLER_DOMAIN}; some are set by the processors listed below.

## 3. Categories we use

**Strictly necessary** — always on. These keep you signed in, protect the account and checkout flows, remember your cookie choices, and preserve theme and layout preferences. The product cannot function without them, so they are not subject to consent.

- Supabase authentication session tokens
- CSRF and abuse-prevention tokens
- \`gradr-theme\` (light/dark preference) and \`gradr-cookie-consent\` (your choices here)

**Analytics** — optional. Product analytics that tell us which features are used, where flows break, and which pages perform. Data is aggregated and used to improve the product.

- PostHog product analytics
- Internal navigation and page analytics events

**Marketing & attribution** — optional. Used to measure campaigns and credit affiliate partners who referred you.

- \`cf_ref\` affiliate attribution cookie
- Campaign UTM parameters stored for the length of the session

**Functional** — optional. Non-essential conveniences such as remembering dismissed banners, onboarding progress and recently viewed roles.

## 4. Managing your choices

You can accept all, reject the optional categories, or choose category by category the first time you visit. Your choice is stored for 12 months and applies across the site.

You can change it at any time from the "Cookie preferences" link in the footer, or on the [Cookie Policy](/cookie-policy) page. Rejecting analytics and marketing does not restrict access to any feature you have paid for.

Your browser also lets you block or delete cookies. Blocking strictly necessary cookies will sign you out and break checkout.

## 5. Third parties that may set cookies

- **Supabase** — authentication and session management (strictly necessary)
- **Paddle** — checkout, payment and fraud prevention (strictly necessary during checkout)
- **PostHog** — product analytics (analytics)
- **Sentry** — error diagnostics and performance traces (analytics)
- **Google Search Console** — verification only; sets no cookies for visitors

## 6. Do Not Track and global signals

Where your browser sends a Global Privacy Control (GPC) signal, we treat it as a rejection of the analytics and marketing categories.

## 7. Changes and contact

We update this policy when the technologies we use change. The "Last updated" date at the top always reflects the current version. Questions: ${SELLER_CONTACT_EMAIL}.
`;

export const DPA_V1 = `## 1. Scope and roles

This Data Processing Addendum ("DPA") applies where ${SELLER_LEGAL_NAME} ("Gradr", "we") processes personal data on behalf of a customer — for example a university, bootcamp, employer or agency that provides Gradr accounts to its members ("Customer"). It forms part of the [Terms & Conditions](/terms) and should be read with the [Privacy Policy](/privacy).

For that processing the Customer is the **controller** and Gradr is the **processor**. Where an individual signs up directly for their own account, Gradr is the controller and this DPA does not apply.

## 2. Subject matter and duration

Gradr processes personal data for the duration of the Customer's subscription, plus the retention periods described in section 8, solely to provide the Gradr career platform: resume storage and analysis, job matching, application tracking, AI mock interviews and reporting.

## 3. Categories of data and data subjects

**Data subjects:** the Customer's students, members, candidates or employees who hold Gradr accounts.

**Categories of personal data:**

- Account identifiers — name, email address, authentication identifiers
- Resume and career content — work history, education, skills, portfolio links
- Application activity — roles applied to, pipeline stages, notes
- Interview data — audio transcripts, generated scorecards and feedback
- Technical data — IP address, device and browser metadata, usage events

We do not require special-category data. Customers must not upload it deliberately.

## 4. Processing instructions

Gradr processes personal data only on the Customer's documented instructions, which include this DPA and the Customer's use of the product. We will tell the Customer if an instruction appears to infringe applicable data protection law, and we will not sell personal data or use it to train third-party foundation models.

## 5. Confidentiality and security

Personnel with access to personal data are bound by confidentiality obligations. Technical and organisational measures include:

- Encryption in transit (TLS 1.2+) and at rest
- Row-level security so each account can read only its own records
- Role-based administrative access with server-side authorisation checks
- Audit logging of administrative and security-relevant actions
- Least-privilege service credentials and secret management
- Backups with restore testing, and documented incident response

## 6. Sub-processors

The Customer grants general authorisation for the sub-processors below. We will give notice before adding or replacing a sub-processor, and the Customer may object on reasonable data-protection grounds.

- **Supabase** — database, authentication, storage and edge compute
- **Paddle** — merchant of record, billing and tax
- **Google (Gemini)** — AI model inference for scoring, generation and interviews
- **Resend** — transactional email delivery
- **PostHog** — product analytics
- **Sentry** — error and performance monitoring

Each sub-processor is bound by written terms offering protection materially equivalent to this DPA.

## 7. International transfers

Personal data may be processed outside your country, including in the United States. Transfers rely on the EU Standard Contractual Clauses (and the UK Addendum where relevant), together with supplementary technical measures such as encryption and access control.

## 8. Data subject rights, retention and deletion

Gradr provides self-service export and deletion in account settings, and will assist the Customer in responding to access, rectification, erasure, restriction, portability and objection requests.

On termination, or on the Customer's written request, we delete or return personal data within 30 days, except where retention is required by law (for example billing records). Backups age out on their normal rotation, at most 35 days.

## 9. Personal data breach

Gradr notifies the Customer without undue delay, and in any event within 72 hours of becoming aware of a personal data breach affecting their data, with the information needed for the Customer's own regulatory notifications.

## 10. Audits

On reasonable written notice and no more than once a year, Gradr makes available the information necessary to demonstrate compliance with this DPA, and cooperates with audits carried out by the Customer or an independent auditor bound by confidentiality.

## 11. Requesting a signed copy

To execute this DPA for your organisation, email ${SELLER_CONTACT_EMAIL} with your legal entity name, jurisdiction and signatory. We will return a countersigned copy.
`;

export const CHILDRENS_PRIVACY_EFFECTIVE = "2026-08-22";

/**
 * COPPA notice. Gradr is directed to people aged 13+; this page states the
 * minimum age, the age screen, what happens if a child slips through, and how
 * a parent or guardian can have data removed.
 */
export const CHILDRENS_PRIVACY_V1 = `## 1. Gradr is not for children under 13

Gradr is a career platform for students, graduates and working professionals. The service is directed to people who are **13 years of age or older**, and it is not directed to children under 13.

${SELLER_LEGAL_NAME} does not knowingly collect, use or disclose personal information from children under 13, as those terms are used in the United States Children's Online Privacy Protection Act (COPPA) and its implementing rule.

## 2. The age screen

Everyone who creates a Gradr account must first enter their date of birth on a neutral age screen. If the date entered shows an age under 13:

- the account is not created, and no name, email address, password or sign-in with Google, Apple or Microsoft is submitted;
- the date of birth itself is not stored — we keep only a record that this device did not pass the age screen, so we do not ask again;
- optional analytics, marketing and attribution storage is switched off on that device. Only strictly necessary storage that keeps the page working remains.

You cannot get around the screen by re-entering a different date on the same device without clearing the record we keep, and doing so does not change the minimum age.

## 3. What we do if a child registers anyway

If we learn that a person under 13 has created an account — whether from a report, a support conversation, or our own review — we close the account and delete the associated personal information from our production systems promptly, normally within 30 days. Backup copies age out on their normal rotation, at most 35 days. We do not condition a child's participation in any activity on disclosing more information than is reasonably necessary, because we do not knowingly offer any activity to children under 13 at all.

## 4. Parents and guardians

If you believe a child under 13 has given us personal information, contact us at [${SELLER_CONTACT_EMAIL}](mailto:${SELLER_CONTACT_EMAIL}) with the email address or account name used. We will:

- confirm receipt and verify that you are the parent or legal guardian of the child;
- tell you what personal information, if any, we hold;
- delete that information and close the account; and
- confirm to you when the deletion is complete.

You may also ask us to stop any further collection or use of the child's information. There is no charge for any of this, and you do not need a Gradr account to make the request.

## 5. Teenagers aged 13 to 17

Users aged 13 to 17 may use Gradr, subject to our [Terms & Conditions](/terms), and where local law requires parental permission for a minor to enter into a contract or to consent to data processing, that permission must be obtained before using the service. We recommend that a parent or guardian reviews our [Privacy Notice](/privacy) with them. Paid plans are intended to be purchased by an adult account holder.

## 6. No behavioural advertising to minors

We do not sell personal information, and we do not run third-party behavioural advertising inside Gradr. Optional analytics and attribution are consent-based for every visitor and are disabled outright on any device that has declared an age under 13. See our [Cookie Policy](/cookie-policy) for the full list of categories.

## 7. Changes and contact

We will update this notice if our practices change and will revise the effective date shown at the top of this page. Questions about this notice, or about a child's information, go to [${SELLER_CONTACT_EMAIL}](mailto:${SELLER_CONTACT_EMAIL}), ${SELLER_LEGAL_NAME}, ${SELLER_WEBSITE_URL}.
`;
