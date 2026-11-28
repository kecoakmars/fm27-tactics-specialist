"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { DualPhaseTactic, Player } from "@fm27/shared-types";
import { sanitizeFileName, triggerBrowserDownload } from "@/lib/local-folder-sync";
import {
  buildDualPhaseTacticCardSvg,
  renderDualPhasePngBlob,
} from "@/lib/svg-card-exporter";
import { useLocale } from "@/stores/useLocaleStore";

export interface TacticPngPreviewModalProps {
  open: boolean;
  tactic: DualPhaseTactic;
  squadPlayers: readonly Player[];
  onClose: () => void;
  onNotify: (tone: "ok" | "error", text: string) => void;
}

export function TacticPngPreviewModal({
  open,
  tactic,
  squadPlayers,
  onClose,
  onNotify,
}: TacticPngPreviewModalProps) {
  const { locale, t } = useLocale();
  const [showPlayerNames, setShowPlayerNames] = useState(true);
  const [busy, setBusy] = useState<"download" | "copy" | null>(null);

  const hasAnyNames = useMemo(
    () => squadPlayers.length >= 11 || tactic.slots.some((s) => Boolean(s.playerName)),
    [squadPlayers.length, tactic.slots],
  );

  const svgMarkup = useMemo(() => {
    if (!open) return "";
    return buildDualPhaseTacticCardSvg(tactic, {
      squadPlayers,
      locale,
      showPlayerNames,
    });
  }, [locale, open, showPlayerNames, squadPlayers, tactic]);

  const previewUrl = useMemo(() => {
    if (!svgMarkup) return null;
    const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    return URL.createObjectURL(blob);
  }, [svgMarkup]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  if (!open) return null;

  const handleDownload = async () => {
    setBusy("download");
    try {
      const pngBlob = await renderDualPhasePngBlob(tactic, {
        squadPlayers,
        locale,
        showPlayerNames,
      });
      const bytes = new Uint8Array(await pngBlob.arrayBuffer());
      const fileName = sanitizeFileName(tactic.title, ".png");
      triggerBrowserDownload(fileName, bytes, "image/png");
      onNotify("ok", t(`Gambar taktik ${fileName} berhasil diunduh`, `Downloaded ${fileName}`));
      onClose();
    } catch {
      onNotify("error", t("Gagal mengunduh gambar PNG", "Failed to download PNG image"));
    } finally {
      setBusy(null);
    }
  };

  const handleCopyImage = async () => {
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
      onNotify(
        "error",
        t(
          "Browser ini tidak mendukung salin gambar langsung, silakan klik Unduh PNG.",
          "Clipboard image copy unsupported in this browser; please click Download PNG.",
        ),
      );
      return;
    }
    setBusy("copy");
    try {
      const pngBlob = await renderDualPhasePngBlob(tactic, {
        squadPlayers,
        locale,
        showPlayerNames,
      });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
      onNotify(
        "ok",
        t("Gambar taktik disalin ke clipboard", "Tactical image copied to clipboard"),
      );
    } catch {
      onNotify("error", t("Gagal menyalin gambar", "Failed to copy image"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      id="png-preview-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("Pratinjau Gambar Taktik PNG", "Tactical PNG Card Preview")}
        className="tactical-surface-elevated w-full max-w-5xl max-h-[92vh] rounded-2xl border border-white/12 flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-[#0B0F19] border-b border-white/10">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-100">
              {t("Pratinjau Kartu Taktik (HD PNG)", "Tactical Card Preview (HD PNG)")}
            </h2>
            <p className="text-xs text-slate-400">
              {t(
                "Lengkap dengan penjelasan sistem IP → OOP, instruksi aktif, 6 pilar keseimbangan, & efektivitas pemain.",
                "Includes IP → OOP gameplan summary, active instructions, 6 balance pillars, & player effectiveness.",
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasAnyNames && (
              <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#111827] border border-white/10 text-xs text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showPlayerNames}
                  onChange={(e) => setShowPlayerNames(e.target.checked)}
                  className="accent-emerald-400 rounded cursor-pointer"
                />
                <span>{t("Nama Pemain", "Player Names")}</span>
              </label>
            )}

            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void handleCopyImage()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#111827] hover:bg-slate-800 text-cyan-300 border border-cyan-500/35 cursor-pointer disabled:opacity-50"
            >
              {busy === "copy"
                ? t("Menyalin...", "Copying...")
                : t("Salin Gambar", "Copy Image")}
            </button>

            <button
              id="confirm-download-png-btn"
              type="button"
              disabled={busy !== null}
              onClick={() => void handleDownload()}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition cursor-pointer disabled:opacity-50"
            >
              {busy === "download"
                ? t("Menyiapkan...", "Rendering...")
                : t("Unduh PNG (2400×1350)", "Download PNG (2400×1350)")}
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label={t("Tutup", "Close")}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Live Card Preview */}
        <div className="p-4 sm:p-5 bg-[#070A12] overflow-auto flex items-center justify-center">
          {previewUrl && (
            <img
              src={previewUrl}
              alt={tactic.title}
              className="w-full h-auto rounded-xl border border-white/10 shadow-2xl select-none"
            />
          )}
        </div>
      </div>
    </div>
  );
}
