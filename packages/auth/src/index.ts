import {
  authAccount,
  authInvitation,
  authMember,
  authOrganization,
  authSession,
  authUser,
  authVerification,
  db,
} from "@mandys/database";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";

import { ac, mandysRoles } from "./permissions";

const isProduction = process.env.NODE_ENV === "production";
const authSecret =
  process.env.BETTER_AUTH_SECRET ??
  (isProduction ? undefined : "mandys-development-only-secret-change-me-0001");

if (!authSecret) {
  throw new Error("BETTER_AUTH_SECRET is required in production");
}

const trustedOrigins = [
  process.env.STOREFRONT_URL ?? (isProduction ? undefined : "http://localhost:3000"),
  process.env.BACKOFFICE_URL ?? (isProduction ? undefined : "http://localhost:3001"),
].filter((origin): origin is string => Boolean(origin));

export const auth = betterAuth({
  appName: "Mandy's",
  baseURL: process.env.BETTER_AUTH_URL ?? (isProduction ? undefined : "http://localhost:4000"),
  secret: authSecret,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: authUser,
      session: authSession,
      account: authAccount,
      verification: authVerification,
      organization: authOrganization,
      member: authMember,
      invitation: authInvitation,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins,
  plugins: [
    organization({
      ac,
      roles: mandysRoles,
      creatorRole: "owner",
      allowUserToCreateOrganization: true,
      organizationLimit: 10,
      membershipLimit: 100,
    }),
  ],
  advanced: {
    cookiePrefix: "mandys",
    useSecureCookies: isProduction,
  },
});

export type Auth = typeof auth;
export { ac, mandysRoles } from "./permissions";
export type { MandysRole } from "./permissions";
