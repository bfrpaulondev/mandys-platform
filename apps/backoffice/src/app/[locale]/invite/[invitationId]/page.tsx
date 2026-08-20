import { isLocale } from "@mandys/i18n";
import { PageShell, Surface } from "@mandys/ui";
import { notFound } from "next/navigation";

import { InvitationCard } from "./invitation-card";

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ locale: string; invitationId: string }>;
}) {
  const { locale, invitationId } = await params;
  if (!isLocale(locale) || !invitationId || invitationId.length > 200) notFound();

  return (
    <PageShell className="grid min-h-screen place-items-center py-12">
      <Surface as="section" padding="none" className="w-full max-w-2xl p-6 shadow-[var(--mandys-shadow-sm)] sm:p-8">
        <InvitationCard locale={locale} invitationId={invitationId} />
      </Surface>
    </PageShell>
  );
}
