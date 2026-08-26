import { Link } from "react-router-dom";
import { Text } from "@/design-system/gradr-9b9b95";
import { LegalPage } from "@/components/legal/LegalPage";
import { LEGAL_PAGES, SELLER_CONTACT_EMAIL, SELLER_TRADING_NAME } from "@/content/legal";
import { COMPANY_IDENTITY } from "@/content/legalPolicies";

const DESCRIPTIONS: Record<string, string> = {
  "/terms": "The agreement between you and us for using Gradr.",
  "/privacy": "What personal data we collect, why, who processes it and your rights.",
  "/cookie-policy": "Cookies and local storage we use, and how to change your choices.",
  "/acceptable-use": "What you may and may not do with the product.",
  "/ai-disclaimer": "Where Gradr uses AI and the limits of its output.",
  "/disclaimer": "Information status, no outcome guarantee, liability limits.",
  "/refund-policy": "Cancellation, renewal and refund handling via Paddle.",
  "/affiliate-disclosure": "How the referral programme works and what affiliates must disclose.",
  "/dpa": "Data processing terms and our sub-processors.",
  "/childrens-privacy": "Our under-13 policy and how a guardian can request removal.",
};

/** Single discoverable index of every Gradr policy plus business identity. */
export default function LegalHub() {
  return (
    <LegalPage
      title="Legal & contact"
      intro={`Every ${SELLER_TRADING_NAME} policy in one place, plus the business and contact details behind the service.`}
    >
      <section className="space-y-3">
        <h2>Policies</h2>
        <ul className="grid gap-3 sm:grid-cols-2 [&_li]:ml-0 [&_li]:list-none">
          {LEGAL_PAGES.map((page) => (
            <li key={page.path}>
              <Link
                to={page.path}
                className="block h-full rounded-card border border-border bg-surface p-4 transition-colors hover:border-primary"
              >
                <Text as="span" variant="h6" className="block">
                  {page.label}
                </Text>
                <Text as="span" variant="body-sm" tone="muted" className="block">
                  {DESCRIPTIONS[page.path] ?? ""}
                </Text>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2>Who you are contracting with</h2>
        <p>
          Payments are processed by <strong>Paddle.com</strong>, our Merchant of Record. Paddle
          handles payment, invoicing, sales tax/VAT and payment-related support for every order.
        </p>
        <div className="overflow-x-auto rounded-card border border-border">
          <table className="w-full text-left text-body-sm">
            <tbody>
              {COMPANY_IDENTITY.map((row) => (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <th scope="row" className="px-4 py-3 font-medium text-foreground">
                    {row.label}
                  </th>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.value ?? (
                      <span className="font-medium text-foreground">
                        Not yet published — to be confirmed before launch
                      </span>
                    )}
                    {row.note && <span className="block text-xs">{row.note}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Questions about any policy on this page:{" "}
          <a
            href={`mailto:${SELLER_CONTACT_EMAIL}`}
            className="text-primary underline underline-offset-2"
          >
            {SELLER_CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
    </LegalPage>
  );
}
