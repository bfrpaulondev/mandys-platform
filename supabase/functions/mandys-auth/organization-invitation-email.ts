type OrganizationInvitationInput = {
  invitationId: string;
  email: string;
  organizationName: string;
  inviterName: string;
  inviterEmail: string;
  role: string | string[];
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function backofficeOrigin() {
  const configured = Deno.env.get("MANDYS_BACKOFFICE_ORIGIN")?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:") return url.origin;
    } catch {
      // Fall through to the production origin.
    }
  }
  return "https://mandyplataform.netlify.app";
}

function render(input: OrganizationInvitationInput) {
  const role = Array.isArray(input.role) ? input.role.join(", ") : input.role;
  const inviteUrl = `${backofficeOrigin()}/en/invite/${encodeURIComponent(input.invitationId)}`;
  const safeInviteUrl = escapeHtml(inviteUrl);
  const safeOrganization = escapeHtml(input.organizationName);
  const safeInviter = escapeHtml(input.inviterName || input.inviterEmail);
  const safeRole = escapeHtml(role);
  return {
    subject: `Invitation to ${input.organizationName} on Mandy's`,
    text: `${input.inviterName || input.inviterEmail} invited you to ${input.organizationName} on Mandy's with the ${role} role.\n\nAccept the invitation:\n${inviteUrl}\n\nOnly accept if you recognize this restaurant and inviter.`,
    html: `<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#171717;max-width:620px"><h1 style="font-size:22px">Join ${safeOrganization} on Mandy's</h1><p>${safeInviter} invited you with the <strong>${safeRole}</strong> role.</p><p><a href="${safeInviteUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#171717;color:#fff;text-decoration:none;font-weight:600">Review invitation</a></p><p style="font-size:13px;color:#666">Only accept if you recognize this restaurant and inviter. The invitation expires automatically.</p></div>`,
  };
}

export async function deliverOrganizationInvitation(input: OrganizationInvitationInput) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("MANDYS_EMAIL_FROM");
  const providerReady = Deno.env.get("MANDYS_EMAIL_PROVIDER_READY") === "true";
  if (!apiKey || !from || !providerReady) {
    console.error("organization invitation unavailable: provider not configured");
    throw new Error("ORGANIZATION_INVITATION_PROVIDER_UNAVAILABLE");
  }

  const rendered = render(input);
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "user-agent": "mandys-auth/1.0",
      },
      body: JSON.stringify({
        from,
        to: [input.email],
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      }),
    });
  } catch {
    console.error("organization invitation provider failure: network error");
    throw new Error("ORGANIZATION_INVITATION_DELIVERY_FAILED");
  }
  if (!response.ok) {
    console.error(`organization invitation provider failure: HTTP_${response.status}`);
    throw new Error("ORGANIZATION_INVITATION_DELIVERY_FAILED");
  }
}
