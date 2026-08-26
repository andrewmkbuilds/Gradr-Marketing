import { LegalPage } from "@/components/legal/LegalPage";
import { PolicyDocument } from "@/components/legal/PolicyDocument";
import { AFFILIATE_DISCLOSURE_V1, POLICIES_V1_EFFECTIVE } from "@/content/legalPolicies";

export default function AffiliateDisclosure() {
  return (
    <LegalPage
      title="Affiliate Disclosure"
      intro="Gradr runs a paid referral programme. This page explains how it works and what it means for buyers and affiliates."
      lastUpdated={POLICIES_V1_EFFECTIVE}
    >
      <PolicyDocument body={AFFILIATE_DISCLOSURE_V1} meta={`Effective ${POLICIES_V1_EFFECTIVE}`} />
    </LegalPage>
  );
}
