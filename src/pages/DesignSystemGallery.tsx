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
  Text,
  Textarea,
} from "@/design-system/gradr-9b9b95";
import RouteSeo from "@/components/RouteSeo";

const BUTTON_VARIANTS = ["primary", "accent", "outline", "ghost", "destructive", "link"] as const;
const BUTTON_SIZES = ["sm", "md", "lg"] as const;
const CARD_VARIANTS = ["outline", "raised", "float"] as const;
const TEXT_ROLES = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "lead",
  "body",
  "body-sm",
  "caption",
  "overline",
  "button",
  "code",
] as const;

/** A gallery pane rendered with a forced theme so both skins show side by side. */
function ThemePane({ theme, children }: { theme: "light" | "dark"; children: React.ReactNode }) {
  return (
    <div className={theme} data-theme={theme} data-gallery-pane={theme}>
      <div className="rounded-card border border-border bg-background p-6 text-foreground">
        <Text variant="overline" className="mb-4 block text-muted-foreground">
          {theme}
        </Text>
        <div className="space-y-8">{children}</div>
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="space-y-4">
      <div>
        <Text id={`${id}-title`} variant="h3" as="h2">
          {title}
        </Text>
        <Text variant="body-sm" className="text-muted-foreground">
          {description}
        </Text>
      </div>
      <div className="grid gap-6 md:grid-cols-2">{children}</div>
    </section>
  );
}

function ButtonSpecimens() {
  return (
    <div className="space-y-4">
      {BUTTON_VARIANTS.map((variant) => (
        <div key={variant} className="space-y-2">
          <Text variant="caption" className="text-muted-foreground">
            {variant}
          </Text>
          <div className="flex flex-wrap items-center gap-3">
            {BUTTON_SIZES.map((size) => (
              <Button key={size} variant={variant} size={size}>
                {size}
              </Button>
            ))}
            <Button variant={variant} data-state="hover">
              hover
            </Button>
            <Button variant={variant} disabled>
              disabled
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function CardSpecimens() {
  return (
    <div className="space-y-4">
      {CARD_VARIANTS.map((variant) => (
        <Card key={variant} variant={variant}>
          <CardTitle>{variant} card</CardTitle>
          <CardDescription>
            Surface, border, radius and shadow come from the card variant — never from page classes.
          </CardDescription>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge>neutral</Badge>
            <Badge variant="primary">primary</Badge>
            <Badge variant="accent">accent</Badge>
            <Badge variant="outline">outline</Badge>
          </div>
        </Card>
      ))}
      <Alert variant="info">Alerts inherit the same token set in both themes.</Alert>
    </div>
  );
}

function InputSpecimens() {
  const [value, setValue] = useState("");
  return (
    <div className="space-y-4">
      <FormField label="Work email" help="We only use this for your affiliate payouts.">
        {(control) => (
          <Input
            {...control}
            type="email"
            placeholder="you@company.com"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        )}
      </FormField>
      <FormField label="Invalid state" error="Enter a valid email address.">
        {(control) => <Input {...control} type="email" defaultValue="not-an-email" />}
      </FormField>
      <FormField label="Disabled state" help="Read-only while the plan is syncing.">
        {(control) => <Input {...control} disabled defaultValue="locked value" />}
      </FormField>
      <FormField label="Notes" help="Textarea shares the control tokens.">
        {(control) => <Textarea {...control} rows={3} placeholder="Tell us more…" />}
      </FormField>
    </div>
  );
}

function TypographySpecimens() {
  return (
    <div className="space-y-2">
      {TEXT_ROLES.map((role) => (
        <div key={role} className="flex flex-wrap items-baseline gap-3">
          <Text variant="caption" className="w-20 shrink-0 text-muted-foreground">
            {role}
          </Text>
          <Text variant={role} as="p">
            Gradr career operating system
          </Text>
        </div>
      ))}
    </div>
  );
}

/**
 * Internal component gallery: every design-system primitive rendered in both
 * themes with hover and disabled states, used by the visual regression suite.
 */
export default function DesignSystemGallery() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 space-y-12" data-testid="design-system-gallery">
      <RouteSeo
        title="Design system gallery | Gradr"
        description="Internal reference of Gradr design-system buttons, cards, inputs and typography in light and dark themes."
        noindex
      />
      <header className="space-y-2">
        <Text variant="h1">Design system gallery</Text>
        <Text variant="lead" className="text-muted-foreground">
          Every primitive, both themes, with hover and disabled states. Import from
          <Text variant="code" as="span">
            {" @/design-system/gradr-9b9b95 "}
          </Text>
          and pick a variant instead of writing colors.
        </Text>
      </header>

      <Section id="buttons" title="Buttons" description="Variants, sizes, hover and disabled.">
        <ThemePane theme="light">
          <ButtonSpecimens />
        </ThemePane>
        <ThemePane theme="dark">
          <ButtonSpecimens />
        </ThemePane>
      </Section>

      <Section id="cards" title="Cards" description="Outline, raised and floating surfaces.">
        <ThemePane theme="light">
          <CardSpecimens />
        </ThemePane>
        <ThemePane theme="dark">
          <CardSpecimens />
        </ThemePane>
      </Section>

      <Section id="inputs" title="Inputs" description="Default, invalid and disabled fields.">
        <ThemePane theme="light">
          <InputSpecimens />
        </ThemePane>
        <ThemePane theme="dark">
          <InputSpecimens />
        </ThemePane>
      </Section>

      <Section id="typography" title="Typography" description="Semantic text roles only.">
        <ThemePane theme="light">
          <TypographySpecimens />
        </ThemePane>
        <ThemePane theme="dark">
          <TypographySpecimens />
        </ThemePane>
      </Section>
    </main>
  );
}
