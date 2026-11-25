"use client";

import { useRef, useState } from "react";
import { exportScheduleJson, parseScheduleJson } from "@fm27/fm-codec";
import { getTrainingPresets } from "@fm27/fm-data";
import { LoadMeterBar } from "../../components/training/LoadMeterBar";
import { SessionPalette } from "../../components/training/SessionPalette";
import { WeeklyScheduleGrid } from "../../components/training/WeeklyScheduleGrid";
import {
  sanitizeFileName,
  triggerBrowserDownload,
} from "../../lib/local-folder-sync";
import {
  exportScheduleFmfInWorker,
  parseScheduleFmfInWorker,
} from "../../lib/worker-client";
import { useFolderSyncStore } from "../../stores/useFolderSyncStore";
import { useTacticStore } from "../../stores/useTacticStore";
import { useTrainingStore } from "../../stores/useTrainingStore";

export default function TrainingPage() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [activeBrushCode, setActiveBrushCode] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const patchVersion = useTacticStore((s) => s.tactic.patchVersion);
  const schedule = useTrainingStore((s) => s.schedule);
  const loadMetrics = useTrainingStore((s) => s.loadMetrics);
  const setSlotSession = useTrainingStore((s) => s.setSlotSession);
  const swapSlots = useTrainingStore((s) => s.swapSlots);
  const applyPreset = useTrainingStore((s) => s.applyPreset);
  const loadSchedule = useTrainingStore((s) => s.loadSchedule);
  const setScheduleMeta = useTrainingStore((s) => s.setScheduleMeta);

  const folderStatus = useFolderSyncStore((s) => s.status);
  const saveScheduleFmfDirect = useFolderSyncStore(
    (s) => s.saveScheduleFmfDirect,
  );

  const presets = getTrainingPresets(patchVersion).Presets;

  async function handleExportFmf() {
    const bytes = await exportScheduleFmfInWorker(schedule);
    const fileName = sanitizeFileName(schedule.name, ".fmf");
    triggerBrowserDownload(fileName, bytes);
    setStatusMsg(`Downloaded ${fileName}`);
  }

  async function handleSaveFolderFmf() {
    const bytes = await exportScheduleFmfInWorker(schedule);
    const saved = await saveScheduleFmfDirect(schedule.name, bytes);
    setStatusMsg(`Synced to ${saved}`);
  }

  function handleExportJson() {
    const json = exportScheduleJson(schedule);
    const fileName = sanitizeFileName(schedule.name, ".fm27-schedule.json");
    triggerBrowserDownload(fileName, json, "application/json");
    setStatusMsg(`Exported ${fileName}`);
  }

  async function handleImportFile(file: File) {
    try {
      if (file.name.toLowerCase().endsWith(".fmf")) {
        const ab = await file.arrayBuffer();
        const parsed = await parseScheduleFmfInWorker(
          new Uint8Array(ab),
          patchVersion,
        );
        loadSchedule(parsed);
        setStatusMsg(`Imported .fmf schedule "${parsed.name}"`);
      } else {
        const text = await file.text();
        const parsed = parseScheduleJson(text);
        loadSchedule(parsed);
        setStatusMsg(`Imported JSON schedule "${parsed.name}"`);
      }
    } catch (err) {
      setStatusMsg(
        err instanceof Error ? err.message : "Failed to import schedule",
      );
    }
  }

  return (
    <main className="mx-auto max-w-[1600px] space-y-5 px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">
            Adaptive Training Recommender &amp; 7x3 Weekly Schedule Builder
          </h1>
          <p className="text-xs text-slate-400">
            Presets calibrated to <code className="text-cyan-300">fm-scoring</code>{" "}
            FM27 attribute progression &amp; binary <code className="text-emerald-300">.tsc / .fmf</code>{" "}
            export.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".fmf,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportFile(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-500/40"
          >
            Import .fmf / JSON
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs text-slate-200 hover:border-emerald-500/40"
          >
            Export .json
          </button>
          {folderStatus === "connected" && (
            <button
              type="button"
              onClick={() => void handleSaveFolderFmf()}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30"
            >
              Save to /schedules/
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleExportFmf()}
            className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Export .fmf Schedule
          </button>
        </div>
      </div>

      <section className="rounded-xl border border-slate-800 bg-[#111827] p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[11px] text-slate-400">
                Schedule Name
              </label>
              <input
                type="text"
                value={schedule.name}
                onChange={(e) => setScheduleMeta({ name: e.target.value })}
                className="mt-1 rounded-lg border border-slate-700 bg-[#0B0F19] px-3 py-1.5 text-xs text-slate-100"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {presets.map((preset) => {
                const active = schedule.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset.id, patchVersion)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                        : "border-slate-700 bg-[#0B0F19] text-slate-300 hover:border-cyan-500/40"
                    }`}
                  >
                    {preset.name}
                  </button>
                );
              })}
            </div>
          </div>

          {statusMsg && (
            <span className="font-mono text-xs text-emerald-300">
              {statusMsg}
            </span>
          )}
        </div>
      </section>

      <LoadMeterBar metrics={loadMetrics} />

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <WeeklyScheduleGrid
            schedule={schedule}
            metrics={loadMetrics}
            patchVersion={patchVersion}
            activeBrushCode={activeBrushCode}
            onAssignSlot={setSlotSession}
            onSwapSlots={swapSlots}
          />
        </div>
        <div className="lg:col-span-4">
          <SessionPalette
            patchVersion={patchVersion}
            activeBrushCode={activeBrushCode}
            onSelectBrush={setActiveBrushCode}
          />
        </div>
      </div>
    </main>
  );
}
