"use client";

import type { Locale } from "@mandys/i18n";
import { useRef, useState } from "react";

type MediaKind = "logo" | "cover";

type SignatureResponse = {
  data?: {
    apiKey: string;
    timestamp: number;
    folder: string;
    uploadPreset: string;
    signature: string;
    uploadUrl: string;
    acceptedMimeTypes: string[];
    maxClientFileBytes: number;
  };
  error?: string;
  message?: string;
};

type CloudinaryResponse = {
  secure_url?: string;
  error?: { message?: string };
};

const copy = {
  "pt-PT": {
    upload: "Carregar imagem",
    uploading: "A carregar…",
    unavailable: "Upload direto ainda não está configurado. Pode continuar a usar uma URL HTTPS.",
    invalidType: "Use JPEG, PNG, WebP ou AVIF.",
    tooLarge: "A imagem excede o limite permitido.",
    failed: "Não foi possível carregar a imagem.",
    urlHelp: "Também pode colar uma URL HTTPS.",
  },
  "pt-BR": {
    upload: "Enviar imagem",
    uploading: "Enviando…",
    unavailable: "O upload direto ainda não está configurado. Você pode continuar usando uma URL HTTPS.",
    invalidType: "Use JPEG, PNG, WebP ou AVIF.",
    tooLarge: "A imagem excede o limite permitido.",
    failed: "Não foi possível enviar a imagem.",
    urlHelp: "Você também pode colar uma URL HTTPS.",
  },
  en: {
    upload: "Upload image",
    uploading: "Uploading…",
    unavailable: "Direct upload is not configured yet. You can keep using an HTTPS URL.",
    invalidType: "Use JPEG, PNG, WebP or AVIF.",
    tooLarge: "The image exceeds the allowed size.",
    failed: "The image could not be uploaded.",
    urlHelp: "You can also paste an HTTPS URL.",
  },
  es: {
    upload: "Subir imagen",
    uploading: "Subiendo…",
    unavailable: "La carga directa aún no está configurada. Puedes seguir usando una URL HTTPS.",
    invalidType: "Usa JPEG, PNG, WebP o AVIF.",
    tooLarge: "La imagen supera el tamaño permitido.",
    failed: "No se pudo subir la imagen.",
    urlHelp: "También puedes pegar una URL HTTPS.",
  },
} as const;

const accepted = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const field =
  "mt-1.5 min-h-11 w-full rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-transparent px-3 outline-none focus:ring-2 focus:ring-[var(--mandys-accent)]";

export function MediaUploadField({
  locale,
  kind,
  label,
  value,
  onChange,
}: {
  locale: Locale;
  kind: MediaKind;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const c = copy[locale];
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    setNotice(null);

    if (!accepted.includes(file.type)) {
      setError(c.invalidType);
      return;
    }
    if (file.size > 10_000_000) {
      setError(c.tooLarge);
      return;
    }

    setBusy(true);
    try {
      const signatureResponse = await fetch("/api/media/v1/signature", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const signature = (await signatureResponse.json().catch(() => ({}))) as SignatureResponse;
      if (signatureResponse.status === 503 && signature.error === "MEDIA_NOT_CONFIGURED") {
        setNotice(c.unavailable);
        return;
      }
      if (!signatureResponse.ok || !signature.data) {
        throw new Error(signature.message ?? c.failed);
      }
      if (!signature.data.acceptedMimeTypes.includes(file.type)) {
        throw new Error(c.invalidType);
      }
      if (file.size > signature.data.maxClientFileBytes) {
        throw new Error(c.tooLarge);
      }

      const formData = new FormData();
      formData.set("file", file);
      formData.set("api_key", signature.data.apiKey);
      formData.set("timestamp", String(signature.data.timestamp));
      formData.set("folder", signature.data.folder);
      formData.set("upload_preset", signature.data.uploadPreset);
      formData.set("signature", signature.data.signature);

      const uploadResponse = await fetch(signature.data.uploadUrl, {
        method: "POST",
        body: formData,
      });
      const uploaded = (await uploadResponse.json().catch(() => ({}))) as CloudinaryResponse;
      if (!uploadResponse.ok || !uploaded.secure_url) {
        throw new Error(uploaded.error?.message ?? c.failed);
      }
      if (!uploaded.secure_url.startsWith("https://")) {
        throw new Error(c.failed);
      }
      onChange(uploaded.secure_url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : c.failed);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div className="text-sm font-medium">
      <label>
        {label}
        <input
          type="url"
          placeholder="https://…"
          className={field}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          className="sr-only"
          accept={accepted.join(",")}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
          className="min-h-9 rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] px-3 text-xs font-semibold disabled:opacity-60"
        >
          {busy ? c.uploading : c.upload}
        </button>
        <span className="text-xs font-normal text-[var(--mandys-foreground-muted)]">{c.urlHelp}</span>
      </div>
      {notice ? <p className="mt-2 text-xs font-normal text-[var(--mandys-foreground-muted)]">{notice}</p> : null}
      {error ? <p role="alert" className="mt-2 text-xs font-normal text-[var(--mandys-danger)]">{error}</p> : null}
    </div>
  );
}
