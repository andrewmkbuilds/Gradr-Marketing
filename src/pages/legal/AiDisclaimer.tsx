import { Text } from "@/design-system/gradr-9b9b95";
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
      <div className="rounded-card border border-border bg-surface-muted p-4">
        <Text as="p" variant="body-sm">
          Gradr does not guarantee interviews, offers, employment, or any ATS pass rate. AI output is
          a first draft you must review before you rely on it.
        </Text>
      </div>
      <PolicyDocument body={AI_DISCLAIMER_V1} meta={`Effective ${POLICIES_V1_EFFECTIVE}`} />
    </LegalPage>
  );
}
