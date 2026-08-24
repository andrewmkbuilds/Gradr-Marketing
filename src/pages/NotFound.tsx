import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Compass, Home, LifeBuoy, RefreshCw, Search, WifiOff } from "lucide-react";
import { Alert, Badge, Card, CardDescription, CardTitle, Text } from "@/design-system/gradr-9b9b95";
import { buttonVariants } from "@/design-system/gradr-9b9b95/gradr/components/button";
import { PublicShell } from "@/components/PublicShell";
import { Seo } from "@/components/Seo";
import { appHref, appLoginHref } from "@/lib/appLinks";
import { track } from "@/lib/telemetry/events";
import {
  NOT_FOUND_DESTINATIONS,
  appDestinations,
  sanitizeRequestedPath,
  suggestRoutes,
  type NotFoundDestination,
} from "@/lib/notFoundSuggestions";

/** Live connectivity, so a miss while offline explains itself. */
function useOnlineStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine !== false,
  );
  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    update();
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/**
 * Branded 404.
 *
 * Three jobs beyond the apology: explain an offline miss (the page data cannot
 * load at all, which is not the same as a wrong URL), rank the closest real
 * routes for the requested path, and record the miss — with the path sanitized
 * before it ever reaches analytics.
 */
const NotFound = () => {
  const { pathname, search } = useLocation();
  const online = useOnlineStatus();

  const requested = useMemo(
    () => sanitizeRequestedPath(`${pathname}${search}`),
    [pathname, search],
  );

  const suggestions = useMemo(
    () => suggestRoutes(requested.path, [...NOT_FOUND_DESTINATIONS, ...appDestinations()], 3),
    [requested.path],
  );

  const popular = useMemo<NotFoundDestination[]>(
    () => [...NOT_FOUND_DESTINATIONS.slice(0, 5), ...appDestinations()],
    [],
  );

  useEffect(() => {
    console.warn("404: no route for", requested.path);
    track("not_found_viewed", {
      requested_path: requested.path,
      path_sanitized: requested.sanitized,
      suggestion_count: suggestions.length,
      top_suggestion: suggestions[0]?.title,
      offline: !online,
    });
    // Only the path identifies the miss; connectivity is captured separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested.path, requested.sanitized]);

  useEffect(() => {
    if (!online) track("not_found_offline", { requested_path: requested.path });
  }, [online, requested.path]);

  const onSuggestionClick = useCallback((destination: NotFoundDestination, kind: string) => {
    track("not_found_suggestion_clicked", {
      destination: destination.to,
      surface: destination.surface,
      kind,
    });
  }, []);

  const renderCard = (item: NotFoundDestination, kind: string) => {
    const body = (
      <Card variant="raised" className="h-full">
        <CardTitle>{item.title}</CardTitle>
        <CardDescription className="mt-2">{item.description}</CardDescription>
      </Card>
    );
    const linkClass =
      "rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
    return item.surface === "app" ? (
      <a
        key={`${kind}-${item.to}`}
        href={item.to}
        className={linkClass}
        onClick={() => onSuggestionClick(item, kind)}
      >
        {body}
      </a>
    ) : (
      <Link
        key={`${kind}-${item.to}`}
        to={item.to}
        className={linkClass}
        onClick={() => onSuggestionClick(item, kind)}
      >
        {body}
      </Link>
    );
  };

  return (
    <PublicShell source="not-found">
      <Seo
        title="Page not found"
        description="This Gradr page doesn't exist. Jump back to the homepage or explore our resume, interview and job search tools."
        path="/404"
        noindex
      />

      <section className="page-shell py-20" data-page="not-found">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline">Error 404</Badge>
          <Text variant="h1" className="mt-6">
            We couldn&apos;t find that page
          </Text>
          <Text variant="lead" className="mx-auto mt-4 max-w-xl">
            The link may be broken, or the page moved when the Gradr product split onto its own app
            subdomain.
          </Text>

          <Text variant="caption" className="mt-6">
            Requested path
          </Text>
          <Text variant="code" as="p" className="mt-1 break-all">
            {requested.path}
          </Text>

          {!online ? (
            <Alert
              variant="danger"
              title="You're offline"
              className="mx-auto mt-8 max-w-xl text-left"
              data-testid="not-found-offline"
            >
              <span className="flex items-start gap-2">
                <WifiOff aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>
                  This page couldn&apos;t load because your device has no internet connection. The
                  address may well be valid — reconnect and try again.
                </span>
              </span>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-4`}
              >
                <RefreshCw aria-hidden="true" className="size-4" />
                Retry
              </button>
            </Alert>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/" className={buttonVariants({ variant: "primary" })}>
              <Home aria-hidden="true" className="size-4" />
              Back to homepage
            </Link>
            <a href={appLoginHref()} className={buttonVariants({ variant: "outline" })}>
              Open the app
              <ArrowRight aria-hidden="true" className="size-4" />
            </a>
            <a href={appHref("/support")} className={buttonVariants({ variant: "ghost" })}>
              <LifeBuoy aria-hidden="true" className="size-4" />
              Get help
            </a>
          </div>

          {suggestions.length > 0 ? (
            <div className="mt-8" data-testid="not-found-did-you-mean">
              <Text variant="body-sm" tone="muted">
                <Search aria-hidden="true" className="mr-2 inline size-4" />
                Did you mean:
              </Text>
              <ul className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                {suggestions.map((item) => (
                  <li key={item.to}>
                    {item.surface === "app" ? (
                      <a
                        href={item.to}
                        onClick={() => onSuggestionClick(item, "did-you-mean")}
                        className="text-primary underline underline-offset-4"
                      >
                        {item.title}
                      </a>
                    ) : (
                      <Link
                        to={item.to}
                        onClick={() => onSuggestionClick(item, "did-you-mean")}
                        className="text-primary underline underline-offset-4"
                      >
                        {item.title}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="mt-16">
          <Text
            variant="overline"
            as="p"
            className="flex items-center justify-center gap-2 text-center"
          >
            <Compass aria-hidden="true" className="size-4" />
            Popular pages
          </Text>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {popular.map((item) => renderCard(item, "popular"))}
          </div>
        </div>
      </section>
    </PublicShell>
  );
};

export default NotFound;
