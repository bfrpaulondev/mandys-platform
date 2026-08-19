import { isLocale } from "@mandys/i18n";
import { PageHeader, PageShell, pageBackLinkClassName } from "@mandys/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MenuBoardV2 } from "./menu-board-v2";

const copy = {
  "pt-PT": { back: "Voltar ao painel", title: "Menu" },
  "pt-BR": { back: "Voltar ao painel", title: "Cardápio" },
  en: { back: "Back to dashboard", title: "Menu" },
  es: { back: "Volver al panel", title: "Menú" },
} as const;

export default async function MenuPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale;
  const c = copy[locale];

  return (
    <PageShell>
      <PageHeader
        back={<Link href={`/${locale}`} className={pageBackLinkClassName}>← {c.back}</Link>}
        eyebrow="Mandy's Menu"
        title={c.title}
      />
      <MenuBoardV2 locale={locale} />
    </PageShell>
  );
}
