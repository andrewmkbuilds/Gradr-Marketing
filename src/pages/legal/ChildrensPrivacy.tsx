import { LegalPage } from "@/components/legal/LegalPage";
import { PolicyDocument } from "@/components/legal/PolicyDocument";
import {
  CHILDRENS_PRIVACY_EFFECTIVE,
  CHILDRENS_PRIVACY_V1,
} from "@/content/legalExtra";
import { SELLER_CONTACT_EMAIL, SELLER_LEGAL_NAME } from "@/content/legal";
import { MINIMUM_AGE } from "@/lib/compliance/coppa";

export default function ChildrensPrivacy() {
  return (
    <LegalPage
      title="Children's Privacy Notice"
      intro={`Gradr is built for people aged ${MINIMUM_AGE} and over. This notice explains how ${SELLER_LEGAL_NAME} keeps children under ${MINIMUM_AGE} out of the service and how a parent or guardian can have information removed.`}
      lastUpdated={CHILDRENS_PRIVACY_EFFECTIVE}
    >
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
        <p className="text-sm text-foreground">
          Parent or guardian with a concern about a child under {MINIMUM_AGE}? Email{" "}
          <a
            href={`mailto:${SELLER_CONTACT_EMAIL}`}
            className="text-primary underline underline-offset-2"
          >
            {SELLER_CONTACT_EMAIL}
          </a>{" "}
          and we will verify your request, delete the information and confirm when it is done.
        </p>
      </div>
      <PolicyDocument
        body={CHILDRENS_PRIVACY_V1}
        meta={`Effective ${CHILDRENS_PRIVACY_EFFECTIVE}`}
      />
    </LegalPage>
  );
}
