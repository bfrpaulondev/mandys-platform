"use client";

import type { Locale } from "@mandys/i18n";
import { Button } from "@mandys/ui";
import { useState } from "react";

type ErrorResponse = { message?: string };

const copy = {
  "pt-PT": { exportTitle: "Exportar dados", exportBody: "Descarrega uma cópia JSON dos dados operacionais deste restaurante. Credenciais, tokens e hashes de IP não são incluídos.", exportButton: "Descarregar exportação", exporting: "A preparar…", deleteTitle: "Eliminar restaurante", deleteBody: "Esta ação elimina permanentemente os dados operacionais e a organização Mandy's numa única transação. A tua conta de utilizador não é apagada.", typeDelete: "Escreve DELETE para confirmar", deleteButton: "Eliminar permanentemente", deleting: "A eliminar…", deleted: "Restaurante eliminado.", ownerOnly: "Estas operações são reservadas ao proprietário da organização." },
  "pt-BR": { exportTitle: "Exportar dados", exportBody: "Baixe uma cópia JSON dos dados operacionais deste restaurante. Credenciais, tokens e hashes de IP não são incluídos.", exportButton: "Baixar exportação", exporting: "Preparando…", deleteTitle: "Excluir restaurante", deleteBody: "Esta ação exclui permanentemente os dados operacionais e a organização Mandy's em uma única transação. Sua conta de usuário não é excluída.", typeDelete: "Digite DELETE para confirmar", deleteButton: "Excluir permanentemente", deleting: "Excluindo…", deleted: "Restaurante excluído.", ownerOnly: "Estas operações são reservadas ao proprietário da organização." },
  en: { exportTitle: "Export data", exportBody: "Download a JSON copy of this restaurant's operational data. Credentials, tokens and IP hashes are not included.", exportButton: "Download export", exporting: "Preparing…", deleteTitle: "Delete restaurant", deleteBody: "This permanently deletes the operational data and Mandy's organization in one transaction. Your user account is not deleted.", typeDelete: "Type DELETE to confirm", deleteButton: "Delete permanently", deleting: "Deleting…", deleted: "Restaurant deleted.", ownerOnly: "These operations are restricted to the organization owner." },
  es: { exportTitle: "Exportar datos", exportBody: "Descarga una copia JSON de los datos operativos de este restaurante. No se incluyen credenciales, tokens ni hashes de IP.", exportButton: "Descargar exportación", exporting: "Preparando…", deleteTitle: "Eliminar restaurante", deleteBody: "Esta acción elimina permanentemente los datos operativos y la organización Mandy's en una sola transacción. Tu cuenta de usuario no se elimina.", typeDelete: "Escribe DELETE para confirmar", deleteButton: "Eliminar permanentemente", deleting: "Eliminando…", deleted: "Restaurante eliminado.", ownerOnly: "Estas operaciones están reservadas al propietario de la organización." },
} as const satisfies Record<Locale, Record<string, string>>;

async function responseError(response: Response) {
  const body = (await response.json().catch(() => ({}))) as ErrorResponse;
  return body.message ?? `Request failed (${response.status})`;
}

export function DataProtectionBoard({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function downloadExport() {
    setExporting(true); setError(null);
    try {
      const response = await fetch("/api/data-protection/v1/export", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error(await responseError(response));
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `mandys-export-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Unexpected error");
    } finally { setExporting(false); }
  }

  async function deleteTenant() {
    if (confirmation !== "DELETE") return;
    setDeleting(true); setError(null);
    try {
      const response = await fetch("/api/data-protection/v1/tenant", {
        method: "DELETE",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      window.location.assign(`/${locale}`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unexpected error");
      setDeleting(false);
    }
  }

  return <div className="space-y-6">
    <p className="text-sm text-[var(--mandys-foreground-muted)]">{c.ownerOnly}</p>
    {error ? <div className="rounded-md bg-[var(--mandys-surface-muted)] p-4 text-sm text-[var(--mandys-foreground-muted)]">{error}</div> : null}
    <section className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 sm:p-6"><h2 className="text-lg font-semibold">{c.exportTitle}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--mandys-foreground-muted)]">{c.exportBody}</p><div className="mt-5"><Button onClick={() => void downloadExport()} disabled={exporting}>{exporting ? c.exporting : c.exportButton}</Button></div></section>
    <section className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 sm:p-6"><h2 className="text-lg font-semibold">{c.deleteTitle}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--mandys-foreground-muted)]">{c.deleteBody}</p><label className="mt-5 block max-w-md text-sm font-medium">{c.typeDelete}<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false} className="mt-2 min-h-11 w-full rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-transparent px-3 outline-none focus:ring-2 focus:ring-[var(--mandys-accent)]" /></label><div className="mt-4"><Button variant="secondary" onClick={() => void deleteTenant()} disabled={deleting || confirmation !== "DELETE"}>{deleting ? c.deleting : c.deleteButton}</Button></div></section>
  </div>;
}
