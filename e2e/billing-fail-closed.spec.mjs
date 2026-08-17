import { expect, test } from "@playwright/test";

const backofficeOrigin =
  process.env.MANDYS_BACKOFFICE_ORIGIN ?? "https://mandyplataform.netlify.app";

function identity() {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: `mandys-e2e-billing-${token}@example.com`,
    password: `Mandy-E2E-billing-${token}!Aa9`,
    restaurantName: `Mandy E2E BILLING ${token}`,
    restaurantSlug: `mandy-e2e-billing-${token}`,
  };
}

async function deleteTenant(request) {
  return request.delete(`${backofficeOrigin}/api/data-protection/v1/tenant`, {
    headers: { accept: "application/json", "content-type": "application/json" },
    data: { confirmation: "DELETE" },
  });
}

async function deleteUser(request, password) {
  return request.post(`${backofficeOrigin}/api/auth/delete-user`, {
    headers: { accept: "application/json", "content-type": "application/json" },
    data: { password },
  });
}

test("private regional pricing cannot create a subscription checkout", async ({ request }) => {
  test.setTimeout(120_000);
  const account = identity();
  let userCreated = false;
  let tenantCreated = false;

  try {
    const signup = await request.post(`${backofficeOrigin}/api/auth/sign-up/email`, {
      headers: { accept: "application/json", "content-type": "application/json" },
      data: { name: "Mandy Billing E2E", email: account.email, password: account.password },
    });
    expect(signup.ok(), `signup returned ${signup.status()}: ${await signup.text()}`).toBeTruthy();
    userCreated = true;

    const organization = await request.post(`${backofficeOrigin}/api/auth/organization/create`, {
      headers: { accept: "application/json", "content-type": "application/json" },
      data: { name: account.restaurantName, slug: `mandys-${account.restaurantSlug}` },
    });
    expect(
      organization.ok(),
      `organization create returned ${organization.status()}: ${await organization.text()}`,
    ).toBeTruthy();
    const organizationBody = await organization.json();
    const organizationId =
      organizationBody?.id ?? organizationBody?.data?.id ?? organizationBody?.organization?.id;
    expect(typeof organizationId).toBe("string");
    tenantCreated = true;

    const active = await request.post(`${backofficeOrigin}/api/auth/organization/set-active`, {
      headers: { accept: "application/json", "content-type": "application/json" },
      data: { organizationId },
    });
    expect(active.ok(), `set-active returned ${active.status()}: ${await active.text()}`).toBeTruthy();

    const onboarding = await request.post(`${backofficeOrigin}/api/runtime/v1/onboarding/restaurant`, {
      headers: { accept: "application/json", "content-type": "application/json" },
      data: {
        publicName: account.restaurantName,
        locationName: "Principal",
        slug: account.restaurantSlug,
        countryCode: "PT",
        timezone: "Europe/Lisbon",
        currency: "EUR",
        defaultLocale: "en",
        enabledLocales: ["en"],
      },
    });
    expect(
      onboarding.ok(),
      `onboarding returned ${onboarding.status()}: ${await onboarding.text()}`,
    ).toBeTruthy();

    const checkout = await request.post(`${backofficeOrigin}/api/billing/v1/checkout`, {
      headers: { accept: "application/json", "content-type": "application/json" },
      data: { planKey: "grow", interval: "month", locale: "en" },
    });
    expect(checkout.status()).toBe(409);
    const body = await checkout.json();
    expect(body?.error).toBe("PRICING_NOT_PUBLIC");
    expect(body?.data?.checkoutUrl).toBeUndefined();
  } finally {
    if (tenantCreated) {
      const tenant = await deleteTenant(request);
      if (tenant.ok()) tenantCreated = false;
    }
    if (userCreated) {
      const user = await deleteUser(request, account.password);
      if (user.ok()) userCreated = false;
    }
  }
});
