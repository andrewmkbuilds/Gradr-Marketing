/**
 * Bundled v1 of the Gradr legal documents.
 *
 * These strings are the source text that seeds version 1 of the
 * `legal_documents` table. The public /terms and /privacy pages render the
 * currently published database version and fall back to these constants if the
 * database is unreachable, so the policies Paddle reviews are never blank.
 *
 * Markdown subset supported by the renderer: `## heading`, `- bullet`,
 * paragraphs, `**bold**` and `[label](href)` links.
 */
import { REFUND_WINDOW_DAYS, SELLER_CONTACT_EMAIL, SELLER_DOMAIN, SELLER_LEGAL_NAME, SELLER_TRADING_NAME, SELLER_WEBSITE_URL } from "./legal";

export const TERMS_V1_EFFECTIVE = "2026-08-12";
export const PRIVACY_V1_EFFECTIVE = "2026-08-12";

export const TERMS_V1 = `## 1. Agreement to these terms

Gradr is operated by ${SELLER_LEGAL_NAME} (trading as ${SELLER_TRADING_NAME}), reachable at ${SELLER_CONTACT_EMAIL}. These Terms & Conditions form a binding agreement between you and us covering your access to and use of the Gradr website at ${SELLER_WEBSITE_URL}, application and related services (the "Service").

By creating an account, signing in, or purchasing a plan on ${SELLER_DOMAIN} you confirm that you have read, understood and agree to these terms. If you do not agree, you must stop using the Service.

We may update these terms from time to time. We will change the "Last updated" date and, where the changes are material, notify you in the product or by email. Continued use after an update means you accept the revised terms.

## 2. Eligibility and age requirements

The Service is intended for people who are at least 13 years old. We ask for your date of birth on a neutral age screen before an account can be created, and we refuse the sign-up if it shows an age under 13. In line with the US Children's Online Privacy Protection Act (COPPA), we do not knowingly collect personal information from children under 13 — see our [Children's Privacy Notice](/childrens-privacy).

If you are 13 or older but under the age of majority where you live, you may only use Gradr with the involvement of a parent or guardian who agrees to these terms on your behalf, and paid plans should be purchased by an adult account holder.

You are responsible for complying with the laws of the country you access Gradr from. The Service is not directed at any jurisdiction where offering it would be unlawful.

## 3. Accounts and security

- You must provide accurate registration details and keep them up to date.
- Accounts are personal. Do not share credentials, resell access, or let others use your entitlements.
- You are responsible for all activity that happens under your account.
- Tell us at ${SELLER_CONTACT_EMAIL} immediately if you suspect unauthorised access.
- You may sign in with email and password or with a supported identity provider (Google, Apple, Microsoft). Guest sessions may be created for trial purposes and can be upgraded into a permanent account.

## 4. Acceptable use

You agree to use Gradr only for lawful, personal career purposes. You will not:

- Upload content you do not have the right to share, including another person's resume or confidential employer material.
- Misrepresent your identity, qualifications or work history in materials you send to employers.
- Scrape, crawl, resell, or systematically extract Gradr data, job listings or AI output.
- Attempt to bypass authentication, plan limits, usage metering, rate limits or security controls.
- Reverse engineer the Service, probe it for vulnerabilities without permission, or interfere with its operation.
- Upload malware, run automated abuse, or use the Service to harass, defame or discriminate.
- Use the Service to build or train a competing product.

## 5. What Gradr provides

Gradr is an AI-assisted career workspace. Depending on your plan it can include resume analysis and ATS scoring, job discovery from third-party sources, job-to-resume matching, an application pipeline tracker, generated application materials, AI mock interviews with feedback reports, skill-gap analysis, and career analytics.

Features evolve. We may add, change or retire functionality, and we will avoid materially degrading a paid plan during a period you have already paid for.

## 6. AI-generated content and its limits

Large parts of Gradr are powered by artificial intelligence. AI output is generated automatically and may be incomplete, outdated or wrong.

- Gradr does not provide legal, financial, immigration, medical or professional career-counselling advice.
- Scores, ATS ratings, match percentages and readiness signals are heuristics and estimates, not guarantees of how any employer or applicant tracking system will treat you.
- You must review, verify and edit anything generated before you send it to an employer. You remain responsible for the accuracy of everything you submit.
- We make no promise that using Gradr will result in interviews, offers or employment.

## 7. Resume analysis and career recommendations

When you upload a resume we parse the document, extract text and produce deterministic scores plus AI suggestions. Recommendations reflect the data available to us at that moment; they are informational and you are free to disregard them.

## 8. Job listings and matching

Job listings shown in Gradr are sourced from third-party providers and public job feeds. We do not control, verify, endorse or guarantee the accuracy, availability, legitimacy or continued existence of any listing, employer or salary figure. Applying for a role creates a relationship between you and that employer, not with us. Always verify a role before sharing personal data with an employer.

## 9. Interview coaching and AI interviews

AI mock interviews are practice simulations. They may use your microphone and, if you enable it, your camera for on-device presence and engagement signals. Sessions can be transcribed and scored to produce feedback reports and practice plans.

- Interview sessions are limited by plan and by session length and monthly minutes.
- Simulated interviewers are not recruiters and their questions or feedback do not represent any real employer.
- You must not use interview functionality to record another identifiable person without their consent.

## 10. Your content

You keep ownership of everything you upload or create in Gradr — resumes, notes, job data, transcripts and generated documents ("Your Content"). You grant us a limited licence to host, process, transmit and display Your Content solely to operate the Service for you, including sending it to the AI and infrastructure providers described in our Privacy Policy.

You are responsible for keeping your own copies. Deleting content or your account removes it in line with the Privacy Policy.

## 11. Intellectual property

The Service itself — software, design, branding, scoring logic, prompts, and documentation — belongs to ${SELLER_LEGAL_NAME} and its licensors. We grant you a personal, non-exclusive, non-transferable, revocable right to use the Service under these terms. No rights are granted beyond that, and the Gradr name and logo may not be used without written permission.

## 12. Third-party services and integrations

Gradr integrates with third-party services for hosting and databases, payments, email delivery, AI model inference, job data, calendar synchronisation, analytics and error monitoring. Where you connect an optional integration (for example a calendar account), you authorise us to exchange the data needed for that feature. Your use of a third-party service is also governed by that provider's own terms, and we are not responsible for their acts or omissions.

## 13. Plans, billing and Paddle

Our order process is conducted by our online reseller **Paddle.com**. Paddle is the **Merchant of Record** for all orders and handles payment, invoicing, tax and payment-related customer service. Paddle's buyer terms apply in addition to these terms.

- Gradr offers a Free plan plus paid Starter, Pro and Advanced plans, billed monthly or annually.
- Each plan carries monthly usage entitlements for resume analyses, application generation and AI interviews. Unlimited entitlements remain subject to fair use and anti-abuse limits.
- Optional credit packs can be purchased to extend usage beyond a plan allowance; credits are consumed as you use metered features and remain available while your account is active.
- Prices are displayed in your local currency where supported and include applicable taxes where Paddle is required to collect them.
- Where a free trial is offered, its length and terms are shown at checkout. Unless you cancel before it ends, the subscription converts to a paid term at the listed price.

## 14. Renewals, cancellation and refunds

Subscriptions renew automatically at the end of each billing period until cancelled. You can cancel at any time from the billing page or through the Paddle customer portal; access continues until the end of the period you have already paid for and is not pro-rated.

Upgrades take effect immediately with a pro-rated charge calculated by Paddle. Downgrades take effect at the next renewal.

We offer a ${REFUND_WINDOW_DAYS}-day refund window as described in our Refund Policy. Statutory withdrawal rights, where they apply to you, are unaffected.

## 15. Failed payments and account restrictions

If a payment fails, Paddle will retry it and we may email you. During this recovery period your access may continue for a short grace window. If payment is not recovered, the subscription lapses and your account moves to the Free plan with its lower entitlements. Your data is retained; paid features simply stop until billing is restored.

## 16. Affiliate and referral programme

If you join the Gradr affiliate programme, additional rules apply:

- Applications are reviewed and may be approved, declined or revoked at our discretion.
- Commissions are earned only on qualifying, completed and non-refunded purchases attributed through your referral link within the attribution window shown in the programme settings.
- Self-referrals, fraudulent clicks, cookie stuffing, paid search on our brand terms, spam and misleading claims about Gradr are prohibited and void any commission.
- Commissions become payable once the minimum payout threshold is met; reversed or refunded transactions are clawed back.
- We may change commission rates and programme terms prospectively, and may suspend an affiliate account for breach.

## 17. Service availability

We work to keep Gradr available but do not promise uninterrupted service. Maintenance, third-party outages, model provider incidents and events outside our control can interrupt access. We do not offer a contractual uptime guarantee on any plan.

## 18. Suspension and termination

You may stop using Gradr at any time and delete your account from Settings. We may suspend or terminate access if you breach these terms, if we are required to by law, if your use creates risk or legal exposure, or if payment fails and is not recovered. Where reasonable we will warn you first. Sections that by nature should survive termination — including intellectual property, disclaimers, liability limits and indemnity — continue to apply.

## 19. Disclaimers

To the maximum extent permitted by law, the Service is provided "as is" and "as available" without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, non-infringement, or accuracy of AI output or job data. Some jurisdictions do not allow the exclusion of certain warranties, so parts of this section may not apply to you, and nothing here removes rights you have as a consumer that cannot be waived.

## 20. Limitation of liability

To the maximum extent permitted by law, ${SELLER_LEGAL_NAME} is not liable for indirect, incidental, special, consequential or punitive damages, or for lost profits, lost opportunities, lost employment, or lost or corrupted data. Our total aggregate liability arising out of or relating to the Service is limited to the greater of the amounts you paid us in the twelve months before the event giving rise to the claim, or USD 100. Nothing in these terms excludes liability for fraud, death or personal injury caused by negligence, or any liability that cannot be limited by law.

## 21. Indemnification

You agree to indemnify and hold harmless ${SELLER_LEGAL_NAME} and its officers, employees and contractors from claims, damages, liabilities and reasonable legal costs arising from your use of the Service, Your Content, your breach of these terms, or your violation of any law or third-party right.

## 22. Electronic communications

By using Gradr you consent to receive communications from us electronically — in-product notices and emails sent to the address on your account. Service, security, billing and legal notices are part of the Service and cannot be switched off while your account is active. Optional product and marketing emails can be turned off in Settings.

## 23. Privacy

Our Privacy Policy explains how we collect and process personal data and is incorporated into these terms by reference. Where we publish a new version of the Privacy Policy with material changes, we will notify you and, where required, ask you to accept it before continuing to use affected features.

## 24. Governing law and disputes

These terms are governed by the laws applicable at the seller's place of establishment, without regard to conflict-of-law rules, and the courts of that jurisdiction have non-exclusive jurisdiction. If you are a consumer, you keep the protection of the mandatory consumer laws of your country of residence and may bring proceedings there.

Before starting formal proceedings, please contact us at ${SELLER_CONTACT_EMAIL} so we can try to resolve the issue informally. Payment and refund disputes are handled in the first instance by Paddle as Merchant of Record.

## 25. General

If any provision is found unenforceable, the rest remains in force. Our failure to enforce a provision is not a waiver. You may not assign these terms; we may assign them as part of a reorganisation or sale of the business. These terms, together with the Privacy Policy and Refund Policy, are the entire agreement between us.

## 26. Contact

Questions about these terms: ${SELLER_CONTACT_EMAIL}. Payment, invoice and tax questions are handled by Paddle.com as Merchant of Record.`;

export const PRIVACY_V1 = `## 1. Introduction

This privacy notice explains how ${SELLER_LEGAL_NAME} (trading as ${SELLER_TRADING_NAME}, "we", "us") collects, uses, shares and protects personal data when you use the Gradr website at ${SELLER_WEBSITE_URL} and application (the "Services").

We are the data controller for that personal data. If you have any question or want to exercise a privacy right, contact us at ${SELLER_CONTACT_EMAIL}.

If you do not agree with this notice, please do not use the Services.

## 2. Summary of key points

- We collect the account details you give us, the career content you upload, the way you use the product, and billing metadata from our payment provider.
- Resumes, job data, interview transcripts and generated documents are processed to deliver the features you ask for.
- We use third-party processors for hosting, AI inference, payments, email, analytics and error monitoring; we do not sell personal data.
- You can export or permanently delete your account and data from Settings at any time.
- Depending on where you live you may have rights of access, correction, deletion, portability and objection.

## 3. Personal data we collect

**Account and authentication data.** Name or display name, email address, hashed authentication credentials handled by our authentication provider, sign-in provider (email, Google, Apple, Microsoft), account role, and session metadata. Anonymous guest sessions carry only a generated identifier until you upgrade to a permanent account.

**Profile and career preferences.** Target role, target salary, target industry, career stage, locations, remote preference, experience level and keywords you set.

**Resume and CV content.** Uploaded PDF or DOCX files, the text extracted from them, version labels and the scores, keyword analysis and AI suggestions produced from them. Resumes routinely contain your employment history, education and contact details, so we treat them as sensitive to you and store them in a private, access-controlled bucket.

**Job and application data.** Jobs you save or track, employer names, listing URLs, statuses, notes, reminders, match scores, matched and missing skills, and generated application materials such as tailored cover letters.

**Interview data.** Mock interview transcripts, question and answer turns, scores, feedback reports, practice plans, session length and quality metrics (latency, reconnects, interruptions). Live audio from your microphone is streamed to the AI voice provider to run the conversation in real time. If you enable your camera, presence and engagement signals are computed in your browser; we do not upload or store camera video. Generated report files are stored in a private bucket linked to your account.

**Usage, device and diagnostic data.** Pages and features used, feature usage counters and entitlement checks, referral and campaign parameters, approximate device and browser type, IP address, and error and performance diagnostics.

**Billing data.** Plan, subscription status, billing interval, period dates, customer and subscription identifiers, purchase records and country of purchase. We never see or store your full card details — those are handled by Paddle.

**Communications.** Emails we send you, delivery status, notification preferences, and support correspondence.

**Affiliate data (only if you join the programme).** Application details, payout email and method, referral clicks, referred signups, commissions and payouts.

## 4. How and why we use personal data

- To provide the Services: parsing and scoring resumes, matching jobs, generating application materials, running AI interviews and producing reports.
- To create and secure your account, authenticate you, and prevent fraud and abuse.
- To enforce plan entitlements, meter usage and apply rate limits.
- To process payments, issue invoices and meet tax and accounting obligations.
- To send service, security, billing and legal notices, and — where you have opted in — job digests and product updates.
- To provide support and respond to your requests.
- To monitor reliability, debug errors and improve the product, usually with aggregated or pseudonymised data.
- To comply with legal obligations and to establish, exercise or defend legal claims.

We do not use your resumes, transcripts or other content to train our own foundation models, and we do not sell personal data or share it for cross-context behavioural advertising.

## 5. Legal bases for processing

Where the GDPR or UK GDPR applies, we rely on:

- **Performance of a contract** — to deliver the Services you sign up for and to bill you.
- **Legitimate interests** — to secure the platform, prevent abuse, understand aggregate product usage and improve features, balanced against your rights.
- **Consent** — for optional communications, optional integrations such as calendar access, and use of your camera or microphone. You can withdraw consent at any time.
- **Legal obligation** — for financial records, tax and lawful requests.

Where another privacy law applies, we process personal data on the equivalent lawful basis available under that law.

## 6. When and with whom we share personal data

We share personal data only with service providers acting on our instructions, and only to the extent needed:

- **Hosting, database, authentication and file storage** — Supabase infrastructure, which stores your account, career data and private file buckets.
- **AI processing** — Google Gemini models (including the realtime voice model used for interviews) and the Lovable AI Gateway, which route prompt content such as resume text, job descriptions and interview turns to produce analysis, generated documents and live interview responses.
- **Voice fallback** — Fish Audio, used only as a speech fallback path when the primary realtime voice provider is unavailable.
- **Payments** — Paddle.com, our Merchant of Record, which collects payment details directly, processes transactions, calculates tax and manages subscriptions.
- **Email delivery** — Resend, used through our connector infrastructure to deliver transactional email such as digests, reminders and policy notices.
- **Job data** — Adzuna and Apify job sources, and Firecrawl or Perplexity when you ask us to research a company or import a job posting from a URL.
- **Analytics and monitoring** — PostHog for product analytics and Sentry for error monitoring.
- **Optional integrations you enable** — Google Calendar for interview scheduling, and Logo.dev for company logos.

We may also disclose personal data where required by law, to enforce our terms, to protect rights and safety, or in connection with a merger, acquisition or sale of assets (in which case we will notify you).

## 7. Cookies and similar technologies

We use strictly necessary cookies and browser storage to keep you signed in, remember your theme, and protect the Service. We use a referral cookie to attribute affiliate signups, and analytics storage to understand aggregate product usage. We do not run third-party advertising cookies. You can clear or block cookies in your browser, but sign-in will not work without the necessary ones.

## 8. International data transfers

We and our processors operate globally, so personal data may be processed in countries other than your own, including the United States. Where data leaves the European Economic Area, the United Kingdom or Switzerland, transfers are protected by appropriate safeguards such as the European Commission's Standard Contractual Clauses or an adequacy decision, together with the contractual and security commitments of our processors.

## 9. How long we keep personal data

- Account, profile and career content: for as long as your account is active.
- Resumes, transcripts, reports and generated documents: until you delete them or delete your account.
- Billing, purchase and tax records: for the period required by law after the transaction, typically up to seven years.
- Security, audit and email delivery logs: retained for a limited period for security and accountability.
- Legal-document acceptance records: retained for the life of the account and for as long as needed to evidence consent.
- Aggregated or anonymised statistics that cannot identify you: retained indefinitely.

When you delete your account, we remove your personal data and stored files from the live systems, except where we must keep specific records to meet a legal obligation or to defend a legal claim. Backups age out on a rolling schedule.

## 10. Security

We use access-controlled infrastructure with row-level security on every user table, private storage buckets, encryption in transit, server-side authorisation for administrative actions, rate limiting, audit logging of sensitive administrative access, and secret management for provider credentials.

No online service can be completely secure, so we cannot guarantee absolute security. Protect your own account with a strong, unique password and tell us at ${SELLER_CONTACT_EMAIL} if you suspect a problem.

## 11. Children and minors

Gradr is directed to people aged 13 and over. We run a neutral age screen before account creation and refuse sign-ups that declare an age under 13; a device that fails the screen also has all optional analytics, marketing and attribution storage disabled. Consistent with COPPA, we do not knowingly collect, use or disclose personal information from children under 13.

If you believe a child under 13 has given us personal data, contact ${SELLER_CONTACT_EMAIL}. We will verify the request from a parent or guardian, delete the information, close the account and confirm when it is done. Full details are in our [Children's Privacy Notice](/childrens-privacy).

## 12. Your privacy rights

Depending on where you live, you may have the right to:

- Access the personal data we hold about you and receive a copy.
- Correct inaccurate or incomplete data.
- Delete your data ("right to be forgotten").
- Receive your data in a portable, machine-readable format.
- Object to or restrict certain processing, including processing based on legitimate interests.
- Withdraw consent at any time, without affecting processing already carried out.
- Not be subject to a decision based solely on automated processing that produces legal or similarly significant effects. Gradr's scores and recommendations are advisory and never make an automated decision about your employment.

If you are in the EEA, the UK or Switzerland, you can also lodge a complaint with your local supervisory authority. If you are a California resident, you have the rights to know, delete, correct and opt out of sale or sharing — we do not sell or share personal data as those terms are defined — and you will never be discriminated against for exercising a right.

## 13. How to exercise your rights

- **Self-service:** open Settings in Gradr to export all of your data as a file, or to permanently delete your account and its content.
- **By email:** write to ${SELLER_CONTACT_EMAIL} with the request and the email address on your account.

We respond to verified requests within 30 days, or sooner where the law requires. We may need to verify your identity before acting, and we will tell you if an exemption applies.

## 14. Changes to this notice

We review this notice regularly. Every published version is numbered, dated and kept on record. When we publish a new version we update the effective date, and where the changes are material we notify account holders by email and ask you to review and accept the updated notice before continuing to use affected features. Historical versions and acceptance records are preserved for audit purposes.

## 15. Contact

${SELLER_LEGAL_NAME} — ${SELLER_CONTACT_EMAIL}. For payment-related privacy questions, Paddle.com acts as Merchant of Record and independent controller for transaction data.`;
