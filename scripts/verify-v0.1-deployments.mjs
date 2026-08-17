#!/usr/bin/env node

const targets = [
  {
    name: "Backoffice login",
    url: process.env.MANDYS_BACKOFFICE_URL ?? "https://mandyplataform.netlify.app/en/login",
    requiredText: ["Mandy"],
  },
  {
    name: "Backoffice health",
    url: `${process.env.MANDYS_BACKOFFICE_ORIGIN ?? "https://mandyplataform.netlify.app"}/api/health`,
    requiredText: ["ok"],
  },
  ...["pt-PT", "pt-BR", "en", "es"].map((locale) => ({
    name: `Storefront ${locale}`,
    url: `${process.env.MANDYS_STOREFRONT_ORIGIN ?? "https://mandy-store-front.netlify.app"}/${locale}`,
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
    const missing = target.requiredText.filter(
      (text) => !body.toLocaleLowerCase().includes(text.toLocaleLowerCase()),
    );

    if (!response.ok || missing.length > 0) {
      failures.push({
        name: target.name,
        status: response.status,
        finalUrl: response.url,
        missing,
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
