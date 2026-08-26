import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import {
  REFUND_POLICY_EFFECTIVE,
  REFUND_WINDOW_DAYS,
  SELLER_CONTACT_EMAIL,
  SELLER_LEGAL_NAME,
} from "@/content/legal";

export default function RefundPolicy() {
  return (
    <LegalPage
      title="Refund Policy"
      intro={`How refunds work for Gradr subscriptions and credit packs sold by ${SELLER_LEGAL_NAME}.`}
      lastUpdated={REFUND_POLICY_EFFECTIVE}
    >
      <LegalSection heading={`${REFUND_WINDOW_DAYS}-day refund window`}>
        <p>
          You can request a full refund within <strong>{REFUND_WINDOW_DAYS} days</strong> of any
          initial subscription purchase, renewal or credit pack purchase. We honour every reasonable
          request made inside this window — you do not need to justify your decision.
        </p>
      </LegalSection>

      <LegalSection heading="How to request a refund">
        <ul className="space-y-1">
          <li>
            Email <strong>{SELLER_CONTACT_EMAIL}</strong> from the address on your account, or
          </li>
          <li>Contact Paddle, our Merchant of Record, using the receipt emailed after your purchase.</li>
        </ul>
        <p>
          Include your order or transaction reference. We acknowledge requests within 2 business days
          and approve or explain our decision within 5 business days.
        </p>
      </LegalSection>

      <LegalSection heading="How refunds are paid">
        <p>
          Approved refunds are issued by <strong>Paddle.com</strong> to the original payment method.
          Funds typically appear within 5–10 business days depending on your bank or card issuer.
          Refunds are made in the currency of the original transaction.
        </p>
      </LegalSection>

      <LegalSection heading="Subscriptions and cancellations">
        <p>
          Cancelling stops future renewals; your plan stays active until the end of the period you
          already paid for. If a renewal charge catches you by surprise, contact us within{" "}
          {REFUND_WINDOW_DAYS} days of that charge and we will refund it. Partial refunds may be
          offered pro rata for longer annual terms outside the standard window at our discretion.
        </p>
      </LegalSection>

      <LegalSection heading="Credit packs">
        <p>
          Unused credit packs are refunded in full within the {REFUND_WINDOW_DAYS}-day window. Where
          credits have been partly consumed we refund the unused portion.
        </p>
      </LegalSection>

      <LegalSection heading="Statutory rights">
        <p>
          Consumers in the EU, UK and other jurisdictions with a statutory cancellation right keep
          those rights in full. Nothing in this policy reduces them.
        </p>
      </LegalSection>

      <LegalSection heading="Exceptions">
        <p>
          We may decline a refund where an account has been suspended for a breach of our Terms, or
          where there is clear evidence of abuse such as repeated purchase-and-refund cycles.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Refund questions: <strong>{SELLER_CONTACT_EMAIL}</strong>. We reply to every message.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
