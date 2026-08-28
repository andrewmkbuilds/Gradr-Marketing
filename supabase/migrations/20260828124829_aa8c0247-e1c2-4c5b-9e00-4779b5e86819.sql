CREATE TABLE public.ops_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  event TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('warn','error','critical')),
  message TEXT NOT NULL,
  context JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_ops_alerts_created ON public.ops_alerts (created_at DESC);
CREATE INDEX idx_ops_alerts_source ON public.ops_alerts (source, created_at DESC);

GRANT SELECT ON public.ops_alerts TO authenticated;
GRANT ALL ON public.ops_alerts TO service_role;
ALTER TABLE public.ops_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read ops alerts" ON public.ops_alerts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS confirm_delivery_status TEXT NOT NULL DEFAULT 'unknown' CHECK (confirm_delivery_status IN ('unknown','sent','failed','suppressed','blocked')),
  ADD COLUMN IF NOT EXISTS confirm_delivery_error TEXT,
  ADD COLUMN IF NOT EXISTS confirm_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confirm_last_attempt_at TIMESTAMP WITH TIME ZONE;