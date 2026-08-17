import { expect, test } from "@playwright/test";

const backofficeOrigin = process.env.MANDYS_BACKOFFICE_ORIGIN ?? "https://mandyplataform.netlify.app";
const roles = ["manager", "reception", "kitchen", "staff", "marketing", "accounting"];
const fakeId = "00000000-0000-4000-8000-000000000001";

const nav = {
  manager: { present: ["Reservations", "Orders", "Menu", "Stock", "Events", "Customers", "Insights", "Notifications", "Team", "Profile", "Operations", "Activity", "Plan"], absent: ["Data"] },
  reception: { present: ["Reservations", "Orders", "Menu", "Events", "Customers", "Insights", "Notifications"], absent: ["Stock", "Team", "Profile", "Operations", "Activity", "Plan", "Data"] },
  kitchen: { present: ["Reservations", "Orders", "Menu", "Stock", "Notifications"], absent: ["Events", "Customers", "Insights", "Team", "Profile", "Operations", "Activity", "Plan", "Data"] },
  staff: { present: ["Reservations", "Orders", "Menu", "Stock", "Notifications"], absent: ["Events", "Customers", "Insights", "Team", "Profile", "Operations", "Activity", "Plan", "Data"] },
  marketing: { present: ["Menu", "Events", "Insights", "Notifications"], absent: ["Reservations", "Orders", "Stock", "Customers", "Team", "Profile", "Operations", "Activity", "Plan", "Data"] },
  accounting: { present: ["Menu", "Stock", "Insights", "Notifications", "Plan"], absent: ["Reservations", "Orders", "Events", "Customers", "Team", "Profile", "Operations", "Activity", "Data"] },
};

const readAccess = {
  manager: { menu: true, reservations: true, events: true, orders: true, stock: true, insights: true, crm: true },
  reception: { menu: true, reservations: true, events: true, orders: true, stock: false, insights: true, crm: true },
  kitchen: { menu: true, reservations: true, events: false, orders: true, stock: true, insights: false, crm: false },
  staff: { menu: true, reservations: true, events: false, orders: true, stock: true, insights: false, crm: false },
  marketing: { menu: true, reservations: false, events: true, orders: false, stock: false, insights: true, crm: false },
  accounting: { menu: true, reservations: false, events: false, orders: false, stock: true, insights: true, crm: false },
};

function identity(prefix) {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: `mandys-e2e-role-${prefix}-${token}@example.com`,
    password: `Mandy-E2E-${prefix}-${token}!Aa9`,
    name: `Mandy E2E ${prefix}`,
    restaurantName: `Mandy E2E Roles ${token}`,
    restaurantSlug: `mandy-e2e-roles-${token}`,
  };
}

async function postJson(context, path, data) {
  return context.request.post(`${backofficeOrigin}${path}`, {
    headers: { accept: "application/json", "content-type": "application/json" },
    data,
  });
}

async function signup(context, user) {
  const response = await postJson(context, "/api/auth/sign-up/email", { name: user.name, email: user.email, password: user.password });
  expect(response.ok(), `signup ${user.email}: ${response.status()} ${await response.text()}`).toBeTruthy();
}

async function provisionOwner(context, owner) {
  await signup(context, owner);
  const organization = await postJson(context, "/api/auth/organization/create", { name: owner.restaurantName, slug: `mandys-${owner.restaurantSlug}` });
  expect(organization.ok(), `organization create: ${organization.status()} ${await organization.text()}`).toBeTruthy();
  const body = await organization.json();
  const organizationId = body?.id ?? body?.data?.id ?? body?.organization?.id;
  expect(typeof organizationId).toBe("string");
  const active = await postJson(context, "/api/auth/organization/set-active", { organizationId });
  expect(active.ok(), `set active: ${active.status()} ${await active.text()}`).toBeTruthy();
  const onboarding = await postJson(context, "/api/runtime/v1/onboarding/restaurant", {
    publicName: owner.restaurantName,
    locationName: "Principal",
    slug: owner.restaurantSlug,
    countryCode: "PT",
    timezone: "Europe/Lisbon",
    currency: "EUR",
    defaultLocale: "en",
    enabledLocales: ["en"],
  });
  expect(onboarding.ok(), `onboarding: ${onboarding.status()} ${await onboarding.text()}`).toBeTruthy();
  return organizationId;
}

async function invite(ownerContext, organizationId, user, role) {
  const response = await postJson(ownerContext, "/api/auth/organization/invite-member", { email: user.email, role, organizationId });
  expect(response.ok(), `invite ${role}: ${response.status()} ${await response.text()}`).toBeTruthy();
  const body = await response.json().catch(() => null);
  let invitationId = body?.id ?? body?.data?.id ?? body?.invitation?.id;
  if (!invitationId) {
    const list = await ownerContext.request.get(`${backofficeOrigin}/api/auth/organization/list-invitations?organizationId=${encodeURIComponent(organizationId)}`, { headers: { accept: "application/json" } });
    expect(list.ok(), `list invitations: ${list.status()} ${await list.text()}`).toBeTruthy();
    const listed = await list.json();
    const invitations = Array.isArray(listed) ? listed : listed?.data ?? listed?.invitations ?? [];
    invitationId = invitations.find((item) => item?.email?.toLowerCase() === user.email.toLowerCase())?.id;
  }
  expect(typeof invitationId, `invitation id for ${role}`).toBe("string");
  return invitationId;
}

async function acceptRole(context, user, invitationId, organizationId) {
  await signup(context, user);
  const accepted = await postJson(context, "/api/auth/organization/accept-invitation", { invitationId });
  expect(accepted.ok(), `accept invitation ${user.email}: ${accepted.status()} ${await accepted.text()}`).toBeTruthy();
  const active = await postJson(context, "/api/auth/organization/set-active", { organizationId });
  expect(active.ok(), `set active ${user.email}: ${active.status()} ${await active.text()}`).toBeTruthy();
}

async function responseError(response) {
  const body = await response.json().catch(() => ({}));
  return body?.error ?? body?.code ?? null;
}

async function assertRead(context, path, allowed, label) {
  const response = await context.request.get(`${backofficeOrigin}${path}`, { headers: { accept: "application/json" } });
  const error = await responseError(response);
  if (allowed) {
    expect(error, `${label} should pass authorization; status=${response.status()}`).not.toBe("FORBIDDEN");
    expect(response.status(), `${label} returned server error`).toBeLessThan(500);
  } else {
    expect(response.status(), `${label} should be forbidden`).toBe(403);
    expect(error, `${label} should return FORBIDDEN`).toBe("FORBIDDEN");
  }
}

async function assertAction(context, method, path, data, allowed, label) {
  const response = await context.request.fetch(`${backofficeOrigin}${path}`, {
    method,
    headers: { accept: "application/json", "content-type": "application/json" },
    data,
  });
  const error = await responseError(response);
  if (allowed) {
    expect(error, `${label} should pass authorization; status=${response.status()}`).not.toBe("FORBIDDEN");
    expect(response.status(), `${label} returned server error`).toBeLessThan(500);
  } else {
    expect(response.status(), `${label} should be forbidden`).toBe(403);
    expect(error, `${label} should return FORBIDDEN`).toBe("FORBIDDEN");
  }
}

async function deleteUser(context, password) {
  return postJson(context, "/api/auth/delete-user", { password });
}

async function cleanupOwner(context, password) {
  const tenant = await context.request.delete(`${backofficeOrigin}/api/data-protection/v1/tenant`, {
    headers: { accept: "application/json", "content-type": "application/json" },
    data: { confirmation: "DELETE" },
  });
  if (!tenant.ok() && tenant.status() !== 401) throw new Error(`tenant cleanup: ${tenant.status()} ${await tenant.text()}`);
  const user = await deleteUser(context, password);
  if (!user.ok() && user.status() !== 401) throw new Error(`owner cleanup: ${user.status()} ${await user.text()}`);
}

test("operational roles enforce navigation and API least privilege", async ({ browser }) => {
  test.setTimeout(900_000);
  const owner = identity("owner");
  const ownerContext = await browser.newContext();
  const memberContexts = [];
  let organizationCreated = false;
  let ownerCreated = false;

  try {
    const organizationId = await provisionOwner(ownerContext, owner);
    organizationCreated = true;
    ownerCreated = true;

    for (const role of roles) {
      const user = identity(role);
      const invitationId = await invite(ownerContext, organizationId, user, role);
      const context = await browser.newContext();
      memberContexts.push({ context, user, role });
      await acceptRole(context, user, invitationId, organizationId);

      const page = await context.newPage();
      await page.goto(`${backofficeOrigin}/en`, { waitUntil: "domcontentloaded", timeout: 25_000 });
      await expect(page.getByRole("navigation", { name: "Mandy's" })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(new RegExp(`role:\\s*${role}`, "i"))).toBeVisible({ timeout: 15_000 });
      for (const label of nav[role].present) await expect(page.getByRole("link", { name: label, exact: true })).toBeVisible();
      for (const label of nav[role].absent) await expect(page.getByRole("link", { name: label, exact: true })).toHaveCount(0);

      const access = readAccess[role];
      await assertRead(context, "/api/menu/v1/menu", access.menu, `${role} menu read`);
      await assertRead(context, "/api/reservations/v1/reservations?limit=1", access.reservations, `${role} reservations read`);
      await assertRead(context, "/api/events/v1/events?limit=1", access.events, `${role} events read`);
      await assertRead(context, "/api/orders/v1/orders?limit=1", access.orders, `${role} orders read`);
      await assertRead(context, "/api/stock/v1/stock", access.stock, `${role} stock read`);
      await assertRead(context, "/api/insights/v1/insights?days=7", access.insights, `${role} insights read`);
      await assertRead(context, "/api/crm/v1/customers?limit=1", access.crm, `${role} CRM read`);

      await assertAction(context, "POST", "/api/menu/v1/menu", {}, role === "manager", `${role} menu create`);
      await assertAction(context, "PATCH", `/api/menu/v1/menu/${fakeId}`, { internalName: "Role test" }, ["manager", "kitchen", "marketing"].includes(role), `${role} menu update`);
      await assertAction(context, "PATCH", `/api/menu/v1/menu/${fakeId}`, { isPublished: true }, ["manager", "marketing"].includes(role), `${role} menu publish`);
      await assertAction(context, "POST", "/api/stock/v1/ingredients", {}, role === "manager", `${role} ingredient create`);
      await assertAction(context, "POST", "/api/stock/v1/movements", {}, ["manager", "kitchen"].includes(role), `${role} stock adjust`);
      await assertAction(context, "POST", "/api/reservations/v1/reservations", {}, ["manager", "reception"].includes(role), `${role} reservation create`);
      await assertAction(context, "POST", "/api/events/v1/events", {}, ["manager", "reception", "marketing"].includes(role), `${role} event create`);
      await assertAction(context, "PATCH", `/api/orders/v1/orders/${fakeId}/status`, { status: "accepted" }, ["manager", "reception", "kitchen", "staff"].includes(role), `${role} order update`);

      const protectedDelete = await deleteUser(context, user.password);
      expect(protectedDelete.status(), `${role} account must not delete while still a member`).toBe(400);
    }

    await cleanupOwner(ownerContext, owner.password);
    organizationCreated = false;
    ownerCreated = false;

    for (const entry of memberContexts) {
      const response = await deleteUser(entry.context, entry.user.password);
      expect(response.ok(), `${entry.role} account cleanup: ${response.status()} ${await response.text()}`).toBeTruthy();
    }
  } finally {
    if (organizationCreated || ownerCreated) {
      try { await cleanupOwner(ownerContext, owner.password); } catch { /* best effort */ }
    }
    for (const entry of memberContexts) {
      try { await deleteUser(entry.context, entry.user.password); } catch { /* best effort */ }
      await entry.context.close();
    }
    await ownerContext.close();
  }
});