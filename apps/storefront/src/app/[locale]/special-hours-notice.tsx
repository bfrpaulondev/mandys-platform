import type { Locale } from "@mandys/i18n";

type SpecialHour = {
  serviceDate: string;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
  label: string | null;
};

const copy = {
  "pt-PT": { title: "Próximas exceções", closed: "Fechado", open: "Horário especial" },
  "pt-BR": { title: "Próximas exceções", closed: "Fechado", open: "Horário especial" },
  en: { title: "Upcoming exceptions", closed: "Closed", open: "Special hours" },
  es: { title: "Próximas excepciones", closed: "Cerrado", open: "Horario especial" },
} as const;

export function SpecialHoursNotice({ locale, rows }: { locale: Locale; rows: SpecialHour[] }) {
  if (rows.length === 0) return null;
  const c = copy[locale];
  const formatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });

  return (
    <div className="mt-5 border-t border-[var(--mandys-border)] pt-5">
      <p className="text-sm font-semibold">{c.title}</p>
      <div className="mt-3 space-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.serviceDate} className="flex items-start justify-between gap-4 text-[var(--mandys-foreground-muted)]">
            <span>{formatter.format(new Date(`${row.serviceDate}T00:00:00.000Z`))}{row.label ? ` · ${row.label}` : ""}</span>
            <span className="text-right font-medium text-[var(--mandys-foreground)]">
              {row.isClosed ? c.closed : `${c.open} ${row.opensAt}–${row.closesAt}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
