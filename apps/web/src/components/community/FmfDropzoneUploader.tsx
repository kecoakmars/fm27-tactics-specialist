"use client";

import { useRef, useState } from "react";
import type { DualPhaseTactic } from "@fm27/shared-types";
import { getBrowserSupabaseClient } from "../../lib/supabase-client";
import { exportFmfInWorker, parseFmfInWorker } from "../../lib/worker-client";
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
        `Parsed binary .fmf -> IP ${parsed.inFormation} / OOP ${parsed.outFormation}`,
      );
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : "Invalid .fmf tactic file",
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
          : `Dual-phase ${activeBoardTactic.inFormation} IP -> ${activeBoardTactic.outFormation} OOP tactic tuned for FM27.`,
      );
    }
    setFeedback("Loaded active Pitch Board tactic into binary .fmf uploader");
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    if (!previewTactic || !fmfBase64) {
      setFeedback("Drop a .fmf file or click Use Active Board Tactic first.");
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
        moderation?: { playstyleTag: string; guideQualityScore: number };
      };

      if (!res.ok) {
        setFeedback(data.error || "Submission rejected");
        return;
      }

      setFeedback(
        `Published! Auto-tagged "${data.moderation?.playstyleTag}" (Quality ${Math.round((data.moderation?.guideQualityScore ?? 0.5) * 100)}%)`,
      );
      onSubmitted();
      setTimeout(() => setOpen(false), 900);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
      >
        + Upload .fmf Tactic
      </button>
    );
  }

  return (
    <section className="rounded-xl border border-emerald-500/40 bg-[#111827] p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            Publish .fmf Tactic (Auto SVG Preview + AI Moderation)
          </h3>
          <p className="text-xs text-slate-400">
            Binary <code className="text-emerald-300">.fmf</code> is parsed automatically into Dual-Phase SVG preview and classified by{" "}
            <code className="text-cyan-300">gemini-decision-1</code>.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-slate-700 px-2.5 py-1 text-xs text-slate-300"
        >
          Cancel
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
            className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/25"
          >
            Choose .fmf File
          </button>
          <button
            type="button"
            onClick={() => void handleUseActiveBoardTactic()}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25"
          >
            Use Active Pitch Board Tactic
          </button>
        </div>

        {previewTactic && (
          <div className="rounded-lg border border-slate-800 bg-[#0B0F19] p-3">
            <div className="mb-2 text-xs font-medium text-slate-300">
              Auto-Generated Dual-Phase Preview (No Screenshot Required):
            </div>
            <AutoTacticThumbnail tactic={previewTactic} />
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-[11px] text-slate-400">
              Tactic Title
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
              Creator Handle
            </label>
            <input
              type="text"
              maxLength={60}
              placeholder="e.g. TacticalLab"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F19] px-3 py-1.5 text-xs text-slate-100"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-slate-400">
            Tactical Guide &amp; Role Notes (min 10 chars)
          </label>
          <textarea
            required
            minLength={10}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Explain key IP/OOP transitions, key player roles, and opposition adjustments..."
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
            className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {submitting ? "Moderating & Publishing..." : "Publish to Gallery"}
          </button>
        </div>
      </form>
    </section>
  );
}
