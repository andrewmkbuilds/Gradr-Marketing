import { LegalPage } from "@/components/legal/LegalPage";
import { PolicyDocument } from "@/components/legal/PolicyDocument";
import { AI_DISCLAIMER_V1, POLICIES_V1_EFFECTIVE } from "@/content/legalPolicies";

export default function AiDisclaimer() {
  return (
    <LegalPage
      title="AI Usage & AI Disclaimer"
      intro="Where Gradr uses artificial intelligence, what its output can and cannot be relied on for, and who is responsible for decisions made from it."
      lastUpdated={POLICIES_V1_EFFECTIVE}
    >
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
        <p className="text-sm text-foreground">
          Gradr does not guarantee interviews, offers, employment, or any ATS pass rate. AI output is
          a first draft you must review before you rely on it.
        </p>
      </div>
      <PolicyDocument body={AI_DISCLAIMER_V1} meta={`Effective ${POLICIES_V1_EFFECTIVE}`} />
    </LegalPage>
  );
}
