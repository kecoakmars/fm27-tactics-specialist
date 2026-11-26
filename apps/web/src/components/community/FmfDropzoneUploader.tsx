"use client";

import { useRef, useState } from "react";
import type { DualPhaseTactic } from "@fm27/shared-types";
import { getBrowserSupabaseClient } from "../../lib/supabase-client";
import { exportFmfInWorker, parseFmfInWorker } from "../../lib/worker-client";
import { useLocale } from "../../stores/useLocaleStore";
import { useTacticStore } from "../../stores/useTacticStore";
import { AutoTacticThumbnail } from "./AutoTacticThumbnail";

interface FmfDropzoneUploaderProps {
  onSubmitted: () => void;
}

function bytesToBase64Browser(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function FmfDropzoneUploader({ onSubmitted }: FmfDropzoneUploaderProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const activeBoardTactic = useTacticStore((s) => s.tactic);
  const { t } = useLocale();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [description, setDescription] = useState("");
  const [previewTactic, setPreviewTactic] = useState<DualPhaseTactic | null>(
    null,
  );
  const [fmfBase64, setFmfBase64] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleFmfFile(file: File) {
    try {
      const ab = await file.arrayBuffer();
      const bytes = new Uint8Array(ab);
      const parsed = await parseFmfInWorker(bytes, activeBoardTactic.patchVersion);
      setPreviewTactic(parsed);
      setFmfBase64(bytesToBase64Browser(bytes));
      if (!title) setTitle(parsed.title);
      if (!description && parsed.description.length >= 10) {
        setDescription(parsed.description);
      }
      setFeedback(
        `IP ${parsed.inFormation} / OOP ${parsed.outFormation}`,
      );
    } catch (err) {
      setFeedback(
        err instanceof Error
          ? err.message
          : t("File taktik .fmf tidak valid", "Invalid .fmf tactic file"),
      );
    }
  }

  async function handleUseActiveBoardTactic() {
    const bytes = await exportFmfInWorker(activeBoardTactic);
    setPreviewTactic(activeBoardTactic);
    setFmfBase64(bytesToBase64Browser(bytes));
    if (!title) setTitle(activeBoardTactic.title);
    if (!description) {
      setDescription(
        activeBoardTactic.description.length >= 10
          ? activeBoardTactic.description
          : `${activeBoardTactic.inFormation} IP -> ${activeBoardTactic.outFormation} OOP (${activeBoardTactic.patchVersion}).`,
      );
    }
    setFeedback(t("Taktik papan aktif dipilih", "Active board tactic selected"));
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    if (!previewTactic || !fmfBase64) {
      setFeedback(
        t(
          "Pilih file .fmf atau gunakan taktik aktif lebih dulu.",
          "Choose a .fmf file or use your active tactic first.",
        ),
      );
      return;
    }
    setSubmitting(true);
    setFeedback(null);

    try {
      const sb = getBrowserSupabaseClient();
      const sessionRes = sb ? await sb.auth.getSession() : null;
      const accessToken = sessionRes?.data.session?.access_token;

      const res = await fetch("/api/community/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          kind: "tactic",
          title,
          description,
          authorName: authorName || undefined,
          gameVersion: previewTactic.patchVersion,
          fmfBase64,
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!res.ok) {
        setFeedback(data.error || t("Gagal membagikan taktik", "Submission rejected"));
        return;
      }

      setFeedback(t("Taktik berhasil dibagikan!", "Tactic published!"));
      onSubmitted();
      setTimeout(() => setOpen(false), 900);
    } catch (err) {
      setFeedback(
        err instanceof Error
          ? err.message
          : t("Gagal mengunggah taktik", "Upload failed"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 cursor-pointer"
      >
        {t("+ Bagikan Taktik (.fmf)", "+ Share Tactic (.fmf)")}
      </button>
    );
  }

  return (
    <section className="rounded-xl border border-emerald-500/40 bg-[#111827] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">
          {t("Bagikan Taktik ke Komunitas", "Share Tactic to Community")}
        </h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-slate-700 px-2.5 py-1 text-xs text-slate-300 cursor-pointer"
        >
          {t("Batal", "Cancel")}
        </button>
      </div>

      <form onSubmit={(e) => void handlePublish(e)} className="mt-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".fmf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFmfFile(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/25 cursor-pointer"
          >
            {t("Pilih File .fmf", "Choose .fmf File")}
          </button>
          <button
            type="button"
            onClick={() => void handleUseActiveBoardTactic()}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25 cursor-pointer"
          >
            {t("Pakai Taktik di Papan", "Use Active Board Tactic")}
          </button>
        </div>

        {previewTactic && (
          <div className="rounded-lg border border-slate-800 bg-[#0B0F19] p-3">
            <AutoTacticThumbnail tactic={previewTactic} />
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-[11px] text-slate-400">
              {t("Nama Taktik", "Tactic Name")}
            </label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F19] px-3 py-1.5 text-xs text-slate-100"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400">
              {t("Nama Pembuat", "Author Name")}
            </label>
            <input
              type="text"
              maxLength={60}
              placeholder="Manager"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F19] px-3 py-1.5 text-xs text-slate-100"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-slate-400">
            {t("Catatan Taktik", "Tactic Notes")}
          </label>
          <textarea
            required
            minLength={10}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t(
              "Ceritakan keunggulan taktik ini, tim yang cocok, atau tips peran pemain...",
              "Describe how this tactic plays, recommended club level, or key roles...",
            )}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F19] p-2.5 text-xs text-slate-100"
          />
        </div>

        <div className="flex items-center justify-between">
          {feedback ? (
            <span className="font-mono text-xs text-cyan-300">{feedback}</span>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
          >
            {submitting ? t("Mengirim...", "Publishing...") : t("Bagikan", "Publish")}
          </button>
        </div>
      </form>
    </section>
  );
}
