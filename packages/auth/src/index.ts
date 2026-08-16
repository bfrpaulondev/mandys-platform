import { db } from "@mandys/database";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";

const trustedOrigins = [
  process.env.STOREFRONT_URL,
  process.env.BACKOFFICE_URL,
].filter((origin): origin is string => Boolean(origin));

export const auth = betterAuth({
  appName: "Mandy's",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins,
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 10,
      membershipLimit: 100,
    }),
  ],
  advanced: {
    cookiePrefix: "mandys",
    useSecureCookies: process.env.NODE_ENV === "production",
  },
});

export type Auth = typeof auth;
