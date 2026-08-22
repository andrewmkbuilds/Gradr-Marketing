/**
 * Responsive layout contract: the sidebar and the dashboard chrome must behave
 * the same way at mobile breakpoints in both light and dark themes.
 *
 * Mobile (<768px):
 *   - the sidebar collapses into an off-canvas drawer (Radix Sheet) and is
 *     opened by the trigger, never rendered inline;
 *   - the bottom tab bar is present with 44px-tall tap targets;
 * Desktop (>=768px):
 *   - the sidebar renders inline and the drawer never mounts.
 *
 * Theme must not change any of the above: the layout is token-driven, so the
 * same structural assertions run with and without `.dark` on <html>.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ signOut: vi.fn() }) }));
vi.mock("@/hooks/useAffiliate", () => ({ useIsAdmin: () => ({ data: false }) }));
vi.mock("@/lib/navAnalytics", async () => {
  const actual = await vi.importActual<typeof import("@/lib/navAnalytics")>("@/lib/navAnalytics");
  return {
    ...actual,
    trackDashboardClick: vi.fn(),
    trackNavGroupToggle: vi.fn(),
    trackNavItemClick: vi.fn(),
    trackMobileTab: vi.fn(),
  };
});

import { AppSidebar } from "@/components/AppSidebar";
import { MobileTabBar } from "@/components/MobileTabBar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

const MOBILE = 390;
const DESKTOP = 1440;

/** Point both innerWidth and matchMedia at a viewport width. */
function setViewport(width: number) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => {
      const max = /max-width:\s*(\d+)px/.exec(query);
      const min = /min-width:\s*(\d+)px/.exec(query);
      const matches = max ? width <= Number(max[1]) : min ? width >= Number(min[1]) : false;
      return {
        matches,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      };
    },
  });
}

function setTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

function renderShell(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SidebarProvider>
        <SidebarTrigger />
        <AppSidebar />
        <MobileTabBar />
      </SidebarProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  setTheme("light");
  setViewport(DESKTOP);
});

describe.each(["light", "dark"] as const)("responsive layout — %s theme", (theme) => {
  beforeEach(() => setTheme(theme));

  it("keeps the sidebar off-canvas on mobile until the trigger opens it", async () => {
    setViewport(MOBILE);
    const user = userEvent.setup();
    renderShell();

    // Nothing inline: the drawer is closed, so no nav landmark is mounted.
    expect(screen.queryByRole("navigation", { name: /main navigation/i })).toBeNull();

    await user.click(screen.getByRole("button", { name: /toggle sidebar/i }));

    const drawer = await screen.findByRole("dialog");
    expect(drawer.getAttribute("data-mobile")).toBe("true");
    expect(within(drawer).getByRole("navigation", { name: /main navigation/i })).toBeInTheDocument();
    // The drawer is named for screen readers even though the label is visual-only.
    expect(within(drawer).getByText(/navigation menu/i)).toBeInTheDocument();
  });

  it("renders the sidebar inline on desktop and never mounts the drawer", async () => {
    setViewport(DESKTOP);
    renderShell();

    expect(screen.getByRole("navigation", { name: /main navigation/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("exposes the mobile tab bar with five 44px tap targets, hidden from md up", () => {
    setViewport(MOBILE);
    renderShell();

    const tabBar = screen.getByRole("navigation", { name: /primary/i });
    expect(tabBar.className).toContain("md:hidden");
    expect(tabBar.className).toContain("fixed");

    const tabs = within(tabBar).getAllByRole("link");
    expect(tabs).toHaveLength(5);
    tabs.forEach((tab) => expect(tab.className).toContain("min-h-11"));
  });

  it("marks the active mobile tab with aria-current", () => {
    setViewport(MOBILE);
    renderShell("/");

    const tabBar = screen.getByRole("navigation", { name: /primary/i });
    const current = within(tabBar)
      .getAllByRole("link")
      .filter((tab) => tab.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
  });

  it("closes the mobile drawer after navigating", async () => {
    setViewport(MOBILE);
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: /toggle sidebar/i }));
    const drawer = await screen.findByRole("dialog");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(drawer).not.toBeInTheDocument();
  });
});
