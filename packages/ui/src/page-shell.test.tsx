import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PageHeader, PageShell, pageBackLinkClassName } from "./page-shell";

describe("PageShell", () => {
  it("renders the shared page container and allows deliberate layout overrides", () => {
    const html = renderToStaticMarkup(
      <PageShell className="max-w-3xl" aria-label="Example page">
        <div>Content</div>
      </PageShell>,
    );

    expect(html).toContain("<main");
    expect(html).toContain('aria-label="Example page"');
    expect(html).toContain("min-h-screen");
    expect(html).toContain("max-w-3xl");
    expect(html).not.toContain("max-w-[1500px]");
  });

  it("renders a semantic shared header with optional back, eyebrow and subtitle content", () => {
    const html = renderToStaticMarkup(
      <PageHeader
        back={<a href="/">Back</a>}
        eyebrow="Mandy's Core"
        title="Customers"
        subtitle="Customer context"
      />,
    );

    expect(html).toContain("<header");
    expect(html).toContain("<h1");
    expect(html).toContain("Customers");
    expect(html).toContain("Mandy&#x27;s Core");
    expect(html).toContain("Customer context");
    expect(html).toContain('href="/"');
  });

  it("keeps the Backoffice back-link treatment in one shared token", () => {
    expect(pageBackLinkClassName).toContain("text-[var(--mandys-foreground-muted)]");
    expect(pageBackLinkClassName).toContain("hover:text-[var(--mandys-foreground)]");
  });
});
