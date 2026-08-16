import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { reportApiFailure } from "@/lib/monitoring/reliability";
import {
  PRIVACY_V1,
  PRIVACY_V1_EFFECTIVE,
  TERMS_V1,
  TERMS_V1_EFFECTIVE,
} from "@/content/legalDocs";

export type LegalDocType = "terms" | "privacy";
export type LegalStatus = "draft" | "published" | "archived";

export interface LegalDocument {
  id: string;
  doc_type: LegalDocType;
  version: number;
  status: LegalStatus;
  title: string;
  content: string | null;
  content_key: string | null;
  summary_of_changes: string | null;
  requires_acceptance: boolean;
  effective_date: string;
  published_at: string | null;
  updated_at?: string;
}

/**
 * Version 1 ships in the bundle so the public policy pages can never render
 * blank (Paddle reviews them). Later versions authored in the admin area store
 * their body in the database.
 */
const BUNDLED: Record<string, string> = {
  "bundled:terms_v1": TERMS_V1,
  "bundled:privacy_v1": PRIVACY_V1,
};

export function resolveLegalBody(doc: Pick<LegalDocument, "content" | "content_key">): string {
  if (doc.content && doc.content.trim()) return doc.content;
  if (doc.content_key && BUNDLED[doc.content_key]) return BUNDLED[doc.content_key];
  return "";
}

export const FALLBACK_DOCUMENTS: Record<LegalDocType, LegalDocument> = {
  terms: {
    id: "fallback-terms",
    doc_type: "terms",
    version: 1,
    status: "published",
    title: "Terms & Conditions",
    content: TERMS_V1,
    content_key: null,
    summary_of_changes: null,
    requires_acceptance: false,
    effective_date: TERMS_V1_EFFECTIVE,
    published_at: null,
  },
  privacy: {
    id: "fallback-privacy",
    doc_type: "privacy",
    version: 1,
    status: "published",
    title: "Privacy Notice",
    content: PRIVACY_V1,
    content_key: null,
    summary_of_changes: null,
    requires_acceptance: false,
    effective_date: PRIVACY_V1_EFFECTIVE,
    published_at: null,
  },
};

/** Currently published version of a policy, with a bundled fallback. */
export function usePublishedLegalDocument(docType: LegalDocType) {
  const [document, setDocument] = useState<LegalDocument>(FALLBACK_DOCUMENTS[docType]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase
      .from("legal_documents")
      .select("*")
      .eq("doc_type", docType)
      .eq("status", "published")
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (data) setDocument(data as LegalDocument);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [docType]);

  const body = useMemo(() => resolveLegalBody(document) || resolveLegalBody(FALLBACK_DOCUMENTS[docType]), [document, docType]);

  return { document, body, loading };
}

export interface PendingAcceptance {
  document_id: string;
  doc_type: string;
  version: number;
  title: string;
  summary_of_changes: string | null;
  effective_date: string;
}

/** Published versions flagged `requires_acceptance` that the user has not accepted. */
export function usePendingLegalAcceptances(enabled: boolean) {
  const [pending, setPending] = useState<PendingAcceptance[]>([]);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setPending([]);
      setLoading(false);
      return;
    }
    const { data: session } = await supabase.auth.getSession();
    const { data, error } = await supabase.rpc("pending_legal_acceptances");
    if (error) {
      // A failure here hides the acceptance modal entirely — never swallow it.
      reportApiFailure("rpc:pending_legal_acceptances", error, {
        code: error.code || undefined,
        message: error.message,
        context: {
          userId: session?.session?.user?.id ?? null,
          hasSession: Boolean(session?.session),
          pgCode: error.code ?? null,
          details: error.details ?? null,
          hint: error.hint ?? null,
        },
      });
    } else {
      setPending((data ?? []) as PendingAcceptance[]);
    }
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const accept = useCallback(
    async (documentId: string) => {
      const { error } = await supabase.rpc("accept_legal_document", {
        _document_id: documentId,
        _user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      });
      if (error) {
        reportApiFailure("rpc:accept_legal_document", error, {
          code: error.code || undefined,
          message: error.message,
          context: { documentId, pgCode: error.code ?? null, hint: error.hint ?? null },
        });
        throw error;
      }
      await refresh();
    },
    [refresh],
  );

  return { pending, loading, accept, refresh };
}

export interface LegalStat {
  document_id: string;
  doc_type: string;
  version: number;
  status: string;
  accepted_count: number;
  total_users: number;
}

/** Admin view: every version plus acceptance analytics. */
export function useAdminLegalDocuments(enabled: boolean) {
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [stats, setStats] = useState<LegalStat[]>([]);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    const [docs, stat] = await Promise.all([
      supabase.from("legal_documents").select("*").order("doc_type").order("version", { ascending: false }),
      supabase.rpc("admin_legal_document_stats"),
    ]);
    if (!docs.error) setDocuments((docs.data ?? []) as LegalDocument[]);
    if (!stat.error) setStats((stat.data ?? []) as LegalStat[]);
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { documents, stats, loading, refresh };
}
