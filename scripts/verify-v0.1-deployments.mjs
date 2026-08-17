#!/usr/bin/env node

const backofficeOrigin =
  process.env.MANDYS_BACKOFFICE_ORIGIN ?? "https://mandyplataform.netlify.app";
const storefrontOrigin =
  process.env.MANDYS_STOREFRONT_ORIGIN ?? "https://mandy-store-front.netlify.app";

const targets = [
  {
    name: "Backoffice login",
    url: process.env.MANDYS_BACKOFFICE_URL ?? `${backofficeOrigin}/en/login`,
    requiredText: ["Mandy"],
  },
  {
    name: "Backoffice health",
    url: `${backofficeOrigin}/api/health`,
    requiredText: ["ok"],
  },
  {
    name: "Backoffice auth gateway",
    url: `${backofficeOrigin}/api/auth/get-session`,
    requiredText: [],
    requiredContentType: "application/json",
  },
  {
    name: "Backoffice PWA manifest",
    url: `${backofficeOrigin}/manifest.webmanifest`,
    requiredText: ["Mandy", "standalone"],
    requiredContentType: "application/manifest+json",
  },
  ...["pt-PT", "pt-BR", "en", "es"].map((locale) => ({
    name: `Storefront ${locale}`,
    url: `${storefrontOrigin}/${locale}`,
    requiredText: ["Mandy"],
  })),
];

const failures = [];

for (const target of targets) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(target.url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "mandys-v0.1-readiness-check/1.0" },
    });
    const body = await response.text();
    const contentType = response.headers.get("content-type") ?? "";
    const missing = target.requiredText.filter(
      (text) => !body.toLocaleLowerCase().includes(text.toLocaleLowerCase()),
    );
    const contentTypeMismatch =
      target.requiredContentType !== undefined &&
      !contentType.toLocaleLowerCase().includes(target.requiredContentType.toLocaleLowerCase());

    if (!response.ok || missing.length > 0 || contentTypeMismatch) {
      failures.push({
        name: target.name,
        status: response.status,
        finalUrl: response.url,
        missing,
        ...(contentTypeMismatch
          ? { expectedContentType: target.requiredContentType, actualContentType: contentType }
          : {}),
      });
      console.error(`FAIL ${target.name}: ${response.status} ${response.url}`);
      continue;
    }

    console.log(`PASS ${target.name}: ${response.status} ${response.url}`);
  } catch (error) {
    failures.push({ name: target.name, error: error instanceof Error ? error.message : String(error) });
    console.error(`FAIL ${target.name}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timeout);
  }
}

if (failures.length > 0) {
  console.error("\nMandy's V0.1 deployment readiness check failed:");
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}

console.log("\nPublic deployment smoke checks passed. Browser E2E is still required before V0.1 is declared ready.");
