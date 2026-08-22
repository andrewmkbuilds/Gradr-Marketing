import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthLayout } from "@/components/AuthLayout";
import { Mail, ArrowLeft, ArrowRight, CheckCircle, AlertCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { authPath, readNext } from "@/lib/nextRedirect";
import { emailSchema, friendlyAuthError } from "@/lib/authErrors";
import { assertPasswordResetTarget } from "@/lib/domain/redirectGuard";
import { urlFor } from "@/config/domains";

const RESEND_COOLDOWN = 45;

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const location = useLocation();
  const nextParam = readNext(location.search);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendReset = async (address: string) => {
    setLoading(true);
    setError(null);
    setNotice(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(address, {
      // Password recovery always lands on the app surface (app.gradr.me in
      // production), never on the public marketing host.
      redirectTo: assertPasswordResetTarget(
        urlFor("app", `/reset-password${nextParam ? `?next=${encodeURIComponent(nextParam)}` : ""}`),
      ),
    });
    setLoading(false);
    if (err) {
      setError(friendlyAuthError(err.message));
      return false;
    }
    setCooldown(RESEND_COOLDOWN);
    return true;
  };

  // Never reloads the page: all feedback is rendered inline below.
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    if (await sendReset(parsed.data)) setSent(true);
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    if (await sendReset(parsed.data)) setNotice("Reset link sent again.");
  };

  const errorBlock = error && (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="break-words">{error}</span>
    </div>
  );

  return (
    <AuthLayout>
      {sent ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
              <CheckCircle className="h-6 w-6 text-primary" aria-hidden="true" />
            </div>
            <h1 className="text-center text-xl font-semibold text-foreground">Check your email</h1>
            <p className="text-center text-sm text-muted-foreground">
              We sent a reset link to{" "}
              <span className="font-medium text-foreground break-words">{email}</span>
            </p>
          </div>

          {errorBlock}
          {notice && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm text-foreground"
            >
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>{notice}</span>
            </div>
          )}

          <div className="space-y-3">
            <Button
              variant="outline"
              className="h-11 w-full border-border"
              onClick={handleResend}
              disabled={loading || cooldown > 0}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : loading ? "Sending…" : "Resend reset link"}
            </Button>
            <Link to={authPath(nextParam)}>
              <Button variant="ghost" className="h-11 w-full gap-2">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to sign in
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-foreground">Reset your password</h1>
            <p className="text-sm text-muted-foreground">
              Enter your email and we'll send you a reset link.
            </p>
          </div>

          {errorBlock}

          <form onSubmit={handleReset} className="space-y-3.5" noValidate>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                required
                autoComplete="email"
                aria-invalid={!!error}
                className="h-11 border-border bg-secondary pl-10"
              />
            </div>
            <Button
              type="submit"
              className="h-11 w-full gap-2 bg-primary font-medium text-primary-foreground"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                  Sending...
                </span>
              ) : (
                <>
                  Send reset link
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </Button>
          </form>

          <Link
            to={authPath(nextParam)}
            className="flex items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to sign in
          </Link>
        </div>
      )}
    </AuthLayout>
  );
}
