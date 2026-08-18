const projectOrigin = "https://dbfmjdissqsdhxhmqkqp.supabase.co";
const functionsOrigin = `${projectOrigin}/functions/v1`;
const requestTimeoutMs = 15_000;
const transientStatuses = new Set([408, 429, 502, 503, 504]);

const services = [
  { slug: "mandys-auth", service: "mandys-auth" },
  { slug: "mandys-dashboard", service: "mandys-dashboard" },
  { slug: "mandys-billing", service: "mandys-billing" },
  {
    slug: "mandys-billing-webhook",
    service: "mandys-billing-webhook",
    safety: (body) => body.liveReady !== true,
    safetyMessage: "live Stripe webhook processing must remain disabled before commercial activation",
  },
  {
    slug: "mandys-billing-portal",
    service: "mandys-billing-portal",
    safety: (body) => body.liveReady !== true,
    safetyMessage: "live Stripe billing management must remain disabled before commercial activation",
  },
  { slug: "mandys-media", service: "mandys-media" },
  { slug: "mandys-retention", service: "mandys-retention" },
  { slug: "mandys-data-protection", service: "mandys-data-protection" },
  {
    slug: "mandys-email-worker",
    service: "mandys-email-worker",
    safety: (body) => body.providerReady !== true,
    safetyMessage: "transactional email provider must remain disabled before provider activation",
  },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, attempt = 1) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "mandys-live-monitor/1.0" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (transientStatuses.has(response.status) && attempt < 3) {
      await sleep(500 * attempt);
      return fetchJson(url, attempt + 1);
    }
    const body = await response.json().catch(() => null);
    return { response, body };
  } catch (error) {
    if (attempt < 3 && (error?.name === "AbortError" || error instanceof TypeError)) {
      await sleep(500 * attempt);
      return fetchJson(url, attempt + 1);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const failures = [];
for (const target of services) {
  const url = `${functionsOrigin}/${target.slug}`;
  try {
    const { response, body } = await fetchJson(url);
    if (!response.ok) {
      failures.push(`${target.slug}: HTTP ${response.status}`);
      continue;
    }
    if (body?.ok !== true || body?.service !== target.service) {
      failures.push(`${target.slug}: invalid health contract`);
      continue;
    }
    if (target.safety && !target.safety(body)) {
      failures.push(`${target.slug}: ${target.safetyMessage}`);
      continue;
    }
    console.log(`OK ${target.slug}`);
  } catch (error) {
    failures.push(`${target.slug}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length > 0) {
  console.error("Edge runtime health monitor failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Verified ${services.length} critical Mandy's Edge runtimes and pre-launch safety switches.`);
}
