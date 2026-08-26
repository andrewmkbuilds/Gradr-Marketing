import { useState } from "react";
import { Route, Routes } from "react-router-dom";
import { SurfaceShell } from "@/components/surface/SurfaceShell";
import { SLink, SurfaceNotFound, CrossLink } from "@/components/surface/SurfaceLink";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/design-system/gradr-9b9b95";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, BookOpen, LifeBuoy, Mail, Activity } from "lucide-react";

const SUPPORT_EMAIL = "support@gradr.me";

const FAQS: { question: string; answer: string }[] = [
  {
    question: "How do I reset my password?",
    answer:
      "On the sign-in page choose “Forgot password” and enter your account email. We'll send a reset link that stays valid for one hour.",
  },
  {
    question: "How do I change or cancel my plan?",
    answer:
      "Open Settings → Billing inside the Gradr app. You can switch between monthly and annual, or cancel — access continues until the end of the paid period.",
  },
  {
    question: "Why is my resume score lower than I expected?",
    answer:
      "ATS scoring weighs structure, keyword coverage against the target role, and measurable impact statements. Open the score breakdown in Resume Intelligence to see exactly which checks failed.",
  },
  {
    question: "My AI Mock Interview won't connect — what should I check?",
    answer:
      "Confirm your browser has microphone permission and that no other app is holding the mic. If the connection still drops, check the status page for a live incident before contacting us.",
  },
  {
    question: "Can I export or delete my data?",
    answer:
      "Yes. Settings → Privacy lets you export everything Gradr holds about you as a file, or permanently delete your account and its data.",
  },
  {
    question: "Do you offer student pricing?",
    answer:
      "We do. Verify a student or academic email during checkout to unlock the eligibility discount on any paid plan.",
  },
];

function SupportHome() {
  return (
    <div className="page-shell py-12">
      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-secondary">Support</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-foreground">
          How can we help?
        </h1>
        <p className="mt-3 text-muted-foreground">
          Answers to the questions we get most, plus a direct line to the team when you need one.
        </p>
      </header>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <SLink
          to="/contact"
          className="interactive group rounded-xl border border-border/60 bg-card p-5 elev-1"
        >
          <LifeBuoy className="h-5 w-5 text-brand-secondary" aria-hidden="true" />
          <h2 className="mt-3 text-sm font-semibold text-foreground">Contact support</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Tell us what happened and we'll reply by email.
          </p>
        </SLink>
        <CrossLink
          surface="docs"
          className="interactive group rounded-xl border border-border/60 bg-card p-5 elev-1"
        >
          <BookOpen className="h-5 w-5 text-brand-secondary" aria-hidden="true" />
          <h2 className="mt-3 text-sm font-semibold text-foreground">Read the docs</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Setup guides, feature reference and troubleshooting.
          </p>
        </CrossLink>
        <CrossLink
          surface="status"
          className="interactive group rounded-xl border border-border/60 bg-card p-5 elev-1"
        >
          <Activity className="h-5 w-5 text-brand-secondary" aria-hidden="true" />
          <h2 className="mt-3 text-sm font-semibold text-foreground">Check status</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            See whether a Gradr service is currently degraded.
          </p>
        </CrossLink>
      </div>

      <section className="mt-12 max-w-3xl">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          Frequently asked questions
        </h2>
        <Accordion type="single" collapsible className="mt-4">
          {FAQS.map((faq) => (
            <AccordionItem key={faq.question} value={faq.question}>
              <AccordionTrigger className="text-left text-sm font-medium">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  );
}

/**
 * Contact form. Support has no inbound ticket table yet, so this composes a
 * pre-filled mail to the support inbox rather than silently dropping a message.
 */
function SupportContact() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    subject || "Gradr support request",
  )}&body=${encodeURIComponent(message)}`;

  return (
    <div className="page-shell py-12">
      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-secondary">Contact</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-foreground">
          Contact Gradr support
        </h1>
        <p className="mt-3 text-muted-foreground">
          Describe the problem with as much detail as you can — the page you were on, what you
          expected, and what happened instead.
        </p>
      </header>

      <form
        className="mt-8 max-w-xl space-y-5 rounded-xl border border-border/60 bg-card p-6 elev-1"
        onSubmit={(event) => {
          event.preventDefault();
          window.location.href = mailto;
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="support-subject">Subject</Label>
          <Input
            id="support-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Billing question"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="support-message">What's going on?</Label>
          <Textarea
            id="support-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={7}
            placeholder="Include the page, the steps you took, and any error message you saw."
            required
          />
        </div>
        <Button type="submit" className="w-full sm:w-auto">
          <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
          Send message
        </Button>
        <p className="text-xs text-muted-foreground">
          This opens your email client addressed to{" "}
          <a className="underline underline-offset-2" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          . We reply within one business day.
        </p>
      </form>

      <div className="mt-10">
        <SLink
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Back to the help center
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </SLink>
      </div>
    </div>
  );
}

export default function SupportSurface() {
  return (
    <SurfaceShell eyebrow="Support" nav={[{ label: "Help center", to: "/" }, { label: "Contact", to: "/contact" }]}>
      <Routes>
        <Route index element={<SupportHome />} />
        <Route path="contact" element={<SupportContact />} />
        <Route path="*" element={<SurfaceNotFound label="Gradr Support" />} />
      </Routes>
    </SurfaceShell>
  );
}
