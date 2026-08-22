import { useState } from "react";

import {
  Alert,
  Badge,
  Button,
  Card,
  CardDescription,
  CardTitle,
  FormField,
  Input,
  Label,
  Text,
  Textarea,
} from "@/design-system/gradr-9b9b95";

/**
 * Storybook-style gallery: every design-system component and semantic token
 * rendered side by side in light and dark, so a change to the token layer is
 * visible in both themes at once. Panels are scoped with `.theme-light` /
 * `.theme-dark`, which re-declare the semantic variables locally — the page
 * itself still follows the user's chosen theme.
 */

const SEMANTIC_TOKENS: { name: string; swatch: string; label: string }[] = [
  { name: "--background", swatch: "bg-background", label: "background" },
  { name: "--surface", swatch: "bg-surface", label: "surface" },
  { name: "--surface-muted", swatch: "bg-surface-muted", label: "surface-muted" },
  { name: "--border", swatch: "bg-border", label: "border" },
  { name: "--foreground", swatch: "bg-foreground", label: "foreground" },
  { name: "--muted-foreground", swatch: "bg-muted-foreground", label: "muted-foreground" },
  { name: "--primary", swatch: "bg-primary", label: "primary" },
  { name: "--primary-foreground", swatch: "bg-primary-foreground", label: "primary-foreground" },
  { name: "--accent", swatch: "bg-accent", label: "accent" },
  { name: "--accent-foreground", swatch: "bg-accent-foreground", label: "accent-foreground" },
  { name: "--destructive", swatch: "bg-destructive", label: "destructive" },
  { name: "--ring", swatch: "bg-ring", label: "ring" },
];

const BUTTON_VARIANTS = ["primary", "accent", "outline", "ghost", "destructive", "link"] as const;
const BADGE_VARIANTS = ["neutral", "primary", "accent", "danger", "outline"] as const;
const TEXT_VARIANTS = ["h3", "h5", "lead", "body", "body-sm", "caption", "overline", "code"] as const;

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <Text variant="h6" as="h3">
          {title}
        </Text>
        {hint ? <Text variant="caption">{hint}</Text> : null}
      </div>
      {children}
    </section>
  );
}

/** Every component in the library, rendered once. Themed by its wrapper. */
function GallerySpecimen({ scope }: { scope: string }) {
  const [text, setText] = useState("");

  return (
    <div className="space-y-8 bg-background p-6">
      <Row title="Buttons" hint="Variants x sizes, plus hover, disabled and loading states.">
        <div className="flex flex-wrap items-center gap-3">
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" aria-label="Icon button">
            ★
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled>Disabled</Button>
          <Button variant="outline" disabled>
            Disabled outline
          </Button>
          <Button loading>Loading</Button>
        </div>
      </Row>

      <Row title="Badges">
        <div className="flex flex-wrap items-center gap-2">
          {BADGE_VARIANTS.map((variant) => (
            <Badge key={variant} variant={variant}>
              {variant}
            </Badge>
          ))}
        </div>
      </Row>

      <Row title="Cards">
        <div className="grid gap-4 sm:grid-cols-3">
          {(["outline", "raised", "float"] as const).map((variant) => (
            <Card key={variant} variant={variant}>
              <CardTitle>{variant}</CardTitle>
              <CardDescription>Card surface with the {variant} treatment.</CardDescription>
            </Card>
          ))}
        </div>
      </Row>

      <Row title="Alerts">
        <div className="space-y-3">
          <Alert title="Info">Neutral guidance for the current screen.</Alert>
          <Alert variant="primary" title="Primary">
            Something worth acting on.
          </Alert>
          <Alert variant="danger" title="Danger">
            Something went wrong and needs attention.
          </Alert>
        </div>
      </Row>

      <Row title="Forms" hint="FormField owns the id, description wiring and error role.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Work email" help="We only use this for receipts." required>
            {(control) => <Input {...control} type="email" placeholder="you@company.com" />}
          </FormField>
          <FormField label="Target role" error="Pick a role before continuing.">
            {(control) => <Input {...control} placeholder="Product Designer" />}
          </FormField>
          <div className="space-y-1.5">
            <Label htmlFor={`${scope}-disabled-input`}>Disabled input</Label>
            <Input id={`${scope}-disabled-input`} disabled placeholder="Not editable" />
          </div>
          <FormField label="Notes" help="Markdown is supported.">
            {(control) => (
              <Textarea {...control} rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add context…" />
            )}
          </FormField>
        </div>
      </Row>

      <Row title="Typography" hint="Semantic roles — never raw Tailwind sizes.">
        <div className="space-y-2">
          {TEXT_VARIANTS.map((variant) => (
            <Text key={variant} variant={variant}>
              {variant} — Career momentum, measured.
            </Text>
          ))}
        </div>
      </Row>

      <Row title="Semantic tokens">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SEMANTIC_TOKENS.map((token) => (
            <div key={token.name} className="space-y-1.5">
              <div className={`h-12 rounded-control border border-border ${token.swatch}`} />
              <Text variant="body-sm">{token.label}</Text>
              <Text variant="code" as="code">
                {token.name}
              </Text>
            </div>
          ))}
        </div>
      </Row>
    </div>
  );
}

function ThemePanel({ theme }: { theme: "light" | "dark" }) {
  return (
    <div className="overflow-hidden rounded-card border border-border">
      <div className="flex items-center justify-between border-b border-border bg-surface-muted px-4 py-2">
        <Text variant="overline">{theme}</Text>
        <Text variant="caption">{theme === "light" ? ":root" : ".dark"}</Text>
      </div>
      <div className={theme === "light" ? "theme-light" : "theme-dark"} data-theme-scope={theme}>
        <GallerySpecimen scope={theme} />
      </div>
    </div>
  );
}

export default function DesignSystemGallery() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-8">
      <header className="space-y-2">
        <Text variant="h2" as="h1">
          Component gallery
        </Text>
        <Text variant="lead">
          Every Gradr design-system component and semantic token, rendered in light and dark side by side. Use it to
          review a token change in both themes before shipping.
        </Text>
      </header>

      <div className="grid gap-6 xl:grid-cols-2">
        <ThemePanel theme="light" />
        <ThemePanel theme="dark" />
      </div>
    </div>
  );
}
