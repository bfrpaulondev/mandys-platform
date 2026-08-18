#!/usr/bin/env node

const publicApiUrl =
  process.env.MANDYS_PUBLIC_API_URL ??
  "https://dbfmjdissqsdhxhmqkqp.supabase.co/functions/v1/mandys-public";
const publicReservationsUrl =
  process.env.MANDYS_PUBLIC_RESERVATIONS_URL ??
  "https://dbfmjdissqsdhxhmqkqp.supabase.co/functions/v1/mandys-public-reservations";

const targets = [
  {
    name: "Public restaurant API",
    url: publicApiUrl,
    required: ["ok"],
  },
  {
    name: "Public reservations API",
    url: `${publicReservationsUrl}/health`,
    required: ["ok", "mandys-public-reservations"],
  },
];

const transientStatuses = new Set([408, 429, 502, 503, 504]);
const maxAttempts = 3;
const requestTimeoutMs = 15_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function probe(target) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const response = await fetch(target.url, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          accept: "application/json",
          "user-agent": "mandys-v0.1-runtime-backend-check/1.0",
        },
      });
      const body = await response.text();
      const normalizedBody = body.toLocaleLowerCase();
      const contentType = response.headers.get("content-type") ?? "";
      const missing = target.required.filter(
        (value) => !normalizedBody.includes(value.toLocaleLowerCase()),
      );

      if (
        response.ok &&
        contentType.toLocaleLowerCase().includes("application/json") &&
        missing.length === 0
      ) {
        return {
          ok: true,
          status: response.status,
          finalUrl: response.url,
          attempts: attempt,
        };
      }

      if (!transientStatuses.has(response.status) || attempt === maxAttempts) {
        return {
          ok: false,
          status: response.status,
          finalUrl: response.url,
          attempts: attempt,
          contentType,
          missing,
        };
      }

      await response.body?.cancel();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) {
        return {
          ok: false,
          attempts: attempt,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    } finally {
      clearTimeout(timeout);
    }

    await sleep(500 * attempt);
  }

  return {
    ok: false,
    attempts: maxAttempts,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  };
}

const results = [];

for (const target of targets) {
  const result = await probe(target);
  results.push({ name: target.name, ...result });

  if (result.ok) {
    console.log(
      `PASS ${target.name}: ${result.status} ${result.finalUrl}${result.attempts > 1 ? ` after ${result.attempts} attempts` : ""}`,
    );
  } else {
    console.error(`FAIL ${target.name}: ${JSON.stringify(result)}`);
  }
}

const failures = results.filter((result) => !result.ok);
if (failures.length > 0) {
  console.error("\nMandy's V0.1 runtime backend check failed:");
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}

console.log(
  "\nMandy's V0.1 public runtime backends are reachable and returning the expected health contracts.",
);
