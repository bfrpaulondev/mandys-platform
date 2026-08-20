type PasswordResetEmailInput = {
  email: string;
  url: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function render(url: string) {
  const safeUrl = escapeHtml(url);
  return {
    subject: "Reset your Mandy's password",
    text: `A password reset was requested for your Mandy's account.\n\nUse this secure link to set a new password:\n${url}\n\nIf you did not request this, you can ignore this message.`,
    html: `<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#171717;max-width:620px"><h1 style="font-size:22px">Reset your Mandy's password</h1><p>A password reset was requested for your Mandy's account.</p><p><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#171717;color:#fff;text-decoration:none;font-weight:600">Set a new password</a></p><p style="font-size:13px;color:#666">If you did not request this, you can ignore this message. This link expires automatically.</p></div>`,
  };
}

export async function deliverPasswordResetEmail(input: PasswordResetEmailInput) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("MANDYS_EMAIL_FROM");
  const providerReady = Deno.env.get("MANDYS_EMAIL_PROVIDER_READY") === "true";

  if (!apiKey || !from || !providerReady) {
    console.error("password reset email unavailable: provider not configured");
    throw new Error("PASSWORD_RESET_EMAIL_PROVIDER_UNAVAILABLE");
  }

  const rendered = render(input.url);
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
    console.error("password reset email provider failure: network error");
    throw new Error("PASSWORD_RESET_EMAIL_DELIVERY_FAILED");
  }

  if (!response.ok) {
    console.error(`password reset email provider failure: HTTP_${response.status}`);
    throw new Error("PASSWORD_RESET_EMAIL_DELIVERY_FAILED");
  }
}
