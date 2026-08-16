"use client";

import { ac, mandysRoles } from "@mandys/auth/permissions";
import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

// The browser talks to the same-origin Next.js auth gateway. That gateway
// forwards requests to the Mandy's auth runtime, keeping cookies first-party
// for the installed PWA and avoiding cross-site session storage.
export const authClient = createAuthClient({
  fetchOptions: {
    credentials: "include",
  },
  plugins: [
    organizationClient({
      ac,
      roles: mandysRoles,
    }),
  ],
});
