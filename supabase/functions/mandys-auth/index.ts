import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { organization } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, memberAc, ownerAc } from "better-auth/plugins/organization/access";
import { drizzle } from "drizzle-orm/postgres-js";
import { boolean, index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import postgres from "postgres";

import { deliverEmailVerification } from "./email-verification-email.ts";
import { deliverOrganizationInvitation } from "./organization-invitation-email.ts";
import { deliverPasswordResetEmail } from "./password-reset-email.ts";

const databaseUrl = Deno.env.get("SUPABASE_DB_URL");
if (!databaseUrl) throw new Error("SUPABASE_DB_URL is required");

const sql = postgres(databaseUrl, {
  prepare: false,
  max: 2,
  idle_timeout: 20,
  connect_timeout: 10,
  connection: { application_name: "mandys-auth-edge", search_path: "mandys,public" },
});

const secretRows = await sql<{ decrypted_secret: string }[]>`
  select decrypted_secret from vault.decrypted_secrets
  where name = 'mandys_better_auth_secret' limit 1
`;
const authSecret = secretRows[0]?.decrypted_secret;
if (!authSecret || authSecret.length < 32) throw new Error("Mandy's auth secret is unavailable");

const authUser = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("user_email_uidx").on(table.email)]);

const authSession = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  activeOrganizationId: text("active_organization_id"),
  activeTeamId: text("active_team_id"),
}, (table) => [uniqueIndex("session_token_uidx").on(table.token), index("session_user_idx").on(table.userId)]);

const authAccount = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("account_provider_account_uidx").on(table.providerId, table.accountId), index("account_user_idx").on(table.userId)]);

const authVerification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("verification_identifier_idx").on(table.identifier)]);

const authOrganization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  logo: text("logo"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  metadata: text("metadata"),
}, (table) => [uniqueIndex("organization_slug_uidx").on(table.slug)]);

const authMember = pgTable("member", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => authOrganization.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  role: text("role").default("member").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("member_org_user_uidx").on(table.organizationId, table.userId), index("member_user_idx").on(table.userId)]);

const authInvitation = pgTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => authOrganization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role"),
  status: text("status").default("pending").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  inviterId: text("inviter_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  teamId: text("team_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("invitation_org_idx").on(table.organizationId), index("invitation_email_idx").on(table.email)]);

const db = drizzle(sql, { schema: {
  user: authUser,
  session: authSession,
  account: authAccount,
  verification: authVerification,
  organization: authOrganization,
  member: authMember,
  invitation: authInvitation,
} });

const statements = {
  ...defaultStatements,
  restaurant: ["read", "update"],
  menu: ["read", "create", "update", "delete", "publish"],
  reservation: ["read", "create", "update", "cancel"],
  customer: ["read", "create", "update", "delete", "export"],
  event: ["read", "create", "update", "delete"],
  order: ["read", "create", "update", "refund"],
  stock: ["read", "create", "update", "adjust"],
  analytics: ["read"],
  settings: ["read", "update"],
} as const;
const ac = createAccessControl(statements);
const operationalFull = {
  restaurant: ["read", "update"],
  menu: ["read", "create", "update", "delete", "publish"],
  reservation: ["read", "create", "update", "cancel"],
  customer: ["read", "create", "update", "delete", "export"],
  event: ["read", "create", "update", "delete"],
  order: ["read", "create", "update", "refund"],
  stock: ["read", "create", "update", "adjust"],
  analytics: ["read"],
  settings: ["read", "update"],
} as const;
const owner = ac.newRole({ ...ownerAc.statements, ...operationalFull });
const manager = ac.newRole({ ...adminAc.statements, ...operationalFull });
const reception = ac.newRole({
  ...memberAc.statements,
  restaurant: [], menu: ["read"], reservation: ["read", "create", "update", "cancel"],
  customer: ["read", "create", "update"], event: ["read", "create", "update"], order: ["read", "create", "update"],
  stock: [], analytics: ["read"], settings: [],
});
const kitchen = ac.newRole({
  ...memberAc.statements,
  restaurant: [], menu: ["read", "update"], reservation: ["read"], customer: [], event: [],
  order: ["read", "update"], stock: ["read", "update", "adjust"], analytics: [], settings: [],
});
const staff = ac.newRole({
  ...memberAc.statements,
  restaurant: [], menu: ["read"], reservation: ["read"], customer: [], event: [],
  order: ["read", "update"], stock: ["read"], analytics: [], settings: [],
});
const marketing = ac.newRole({
  ...memberAc.statements,
  restaurant: [], menu: ["read", "update", "publish"], reservation: [], customer: [],
  event: ["read", "create", "update"], order: [], stock: [], analytics: ["read"], settings: [],
});
const accounting = ac.newRole({
  ...memberAc.statements,
  restaurant: [], menu: ["read"], reservation: [], customer: [], event: [],
  order: [], stock: ["read"], analytics: ["read"], settings: [],
});

const basePath = "/functions/v1/mandys-auth/api/auth";
const auth = betterAuth({
  appName: "Mandy's",
  baseURL: "https://dbfmjdissqsdhxhmqkqp.supabase.co",
  basePath,
  secret: authSecret,
  database: drizzleAdapter(db, { provider: "pg", schema: {
    user: authUser,
    session: authSession,
    account: authAccount,
    verification: authVerification,
    organization: authOrganization,
    member: authMember,
    invitation: authInvitation,
  } }),
  emailVerification: {
    expiresIn: 3600,
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await deliverEmailVerification({ email: user.email, url });
    },
  },
  emailAndPassword: {
    enabled: true,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 3600,
    sendResetPassword: async ({ user, url }) => {
      await deliverPasswordResetEmail({ email: user.email, url });
    },
  },
  user: {
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        const memberships = await sql<{ count: number }[]>`
          select count(*)::int as count from mandys.member where user_id = ${user.id}
        `;
        if ((memberships[0]?.count ?? 0) > 0) {
          throw new APIError("BAD_REQUEST", {
            message: "Leave or delete every Mandy's restaurant organization before deleting the user account",
          });
        }
      },
    },
  },
  trustedOrigins: [
    "https://*.vercel.app",
    "https://*.mandys.pt",
    "https://mandys.pt",
    "https://mandyplataform.netlify.app",
  ],
  plugins: [organization({
    ac,
    roles: { owner, manager, reception, kitchen, staff, marketing, accounting },
    creatorRole: "owner",
    allowUserToCreateOrganization: true,
    organizationLimit: 10,
    membershipLimit: 100,
    disableOrganizationDeletion: true,
    invitationExpiresIn: 60 * 60 * 48,
    requireEmailVerificationOnInvitation: true,
    sendInvitationEmail: async (data) => {
      await deliverOrganizationInvitation({
        invitationId: data.id,
        email: data.email,
        organizationName: data.organization.name,
        inviterName: data.inviter.user.name,
        inviterEmail: data.inviter.user.email,
        role: data.role,
      });
    },
  })],
  advanced: {
    cookiePrefix: "mandys",
    useSecureCookies: true,
    defaultCookieAttributes: { httpOnly: true, secure: true, sameSite: "lax", path: "/" },
  },
});

const trustedCorsOrigin = "https://mandys.pt";
function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    "access-control-allow-headers": "content-type, cookie, origin, x-mandys-gateway",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "vary": "origin",
  };
  if (origin === trustedCorsOrigin) headers["access-control-allow-origin"] = origin;
  return headers;
}

Deno.serve(async (request: Request) => {
  const cors = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const incomingUrl = new URL(request.url);
  if (incomingUrl.pathname.endsWith("/health") || incomingUrl.pathname.endsWith("/mandys-auth")) {
    return new Response(JSON.stringify({ ok: true, service: "mandys-auth" }), {
      headers: { "content-type": "application/json; charset=utf-8", ...cors },
    });
  }
  const authIndex = incomingUrl.pathname.indexOf("/api/auth");
  if (authIndex === -1) {
    return new Response(JSON.stringify({ error: "NOT_FOUND" }), {
      status: 404,
      headers: { "content-type": "application/json; charset=utf-8", ...cors },
    });
  }
  const canonicalUrl = new URL(request.url);
  canonicalUrl.pathname = `${basePath}${incomingUrl.pathname.slice(authIndex + "/api/auth".length)}`;
  const canonicalRequest = new Request(canonicalUrl, request);
  const response = await auth.handler(canonicalRequest);
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(cors)) headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});