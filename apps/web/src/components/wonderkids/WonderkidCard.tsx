"use client";

import { useRouter } from "next/navigation";
import { getRoleProfiles } from "@fm27/fm-data";
import type { AttributeName, RoleFitRanking } from "@fm27/shared-types";
import { useTrainingStore } from "../../stores/useTrainingStore";

interface WonderkidCardProps {
  item: RoleFitRanking;
  patchVersion: string;
}

export function WonderkidCard({ item, patchVersion }: WonderkidCardProps) {
  const router = useRouter();
  const shortlistUids = useTrainingStore((s) => s.shortlistUids);
  const toggleShortlistUid = useTrainingStore((s) => s.toggleShortlistUid);
  const setTargetAttributes = useTrainingStore((s) => s.setTargetAttributes);

  const { wonderkid } = item;
  const isShortlisted = shortlistUids.includes(wonderkid.uid);
  const roleProfiles = getRoleProfiles(patchVersion);
  const inProfile = roleProfiles.Roles.find((r) => r.Id === item.inRoleId);
  const keyAttrs = (inProfile?.Keys ?? [
    "passing",
    "decisions",
    "technique",
    "acceleration",
    "composure",
  ]) as AttributeName[];

  function handleToggleShortlist() {
    const adding = !isShortlisted;
    toggleShortlistUid(wonderkid.uid);
    if (adding) {
      void fetch("/api/analytics/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "wonderkid",
          entityId: String(wonderkid.uid),
          eventType: "shortlist_add",
        }),
      }).catch(() => undefined);
    }
  }

  function handleFocusGrowthInTraining() {
    const lowestRoleKeys = [...keyAttrs].sort(
      (a, b) => (wonderkid.attributes[a] ?? 10) - (wonderkid.attributes[b] ?? 10),
    );
    setTargetAttributes(lowestRoleKeys);
    router.push("/training");
  }

  return (
    <article className="flex flex-col justify-between rounded-xl border border-slate-800 bg-[#111827] p-4 transition hover:border-slate-700">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-100">{wonderkid.name}</h3>
            <p className="text-xs text-slate-400">
              {wonderkid.age}yo · {wonderkid.club} · {wonderkid.nationality} ·{" "}
              <span className="font-mono text-cyan-300">
                {wonderkid.positions.join("/")}
              </span>
            </p>
          </div>
          <span className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 font-mono text-xs font-bold text-emerald-300">
            VR {item.valueRatio.toFixed(1)}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-[#0B0F19] p-2.5 text-center font-mono text-xs">
          <div>
            <div className="text-[10px] text-slate-500">ROLE FIT</div>
            <div className="font-semibold text-cyan-300">
              {item.roleFitScore.toFixed(1)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500">PA RANGE</div>
            <div className="font-semibold text-amber-300">{wonderkid.paRange}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500">EST. FEE</div>
            <div className="font-semibold text-slate-200">
              EUR {wonderkid.estimatedPriceEurM.toFixed(1)}M
            </div>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1">
          {keyAttrs.map((attr) => {
            const val = wonderkid.attributes[attr] ?? 10;
            return (
              <span
                key={attr}
                className="rounded border border-slate-800 bg-slate-900/90 px-1.5 py-0.5 font-mono text-[10px] text-slate-300"
              >
                {attr.replace(/_/g, " ")}:{" "}
                <strong
                  className={
                    val >= 15
                      ? "text-emerald-300"
                      : val >= 13
                        ? "text-cyan-300"
                        : "text-amber-300"
                  }
                >
                  {val}
                </strong>
              </span>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-slate-800/80 pt-3">
        <button
          type="button"
          onClick={handleToggleShortlist}
          className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            isShortlisted
              ? "border-amber-500/50 bg-amber-500/20 text-amber-300"
              : "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
          }`}
        >
          {isShortlisted ? "In Shortlist" : "+ Add to Shortlist"}
        </button>
        <button
          type="button"
          onClick={handleFocusGrowthInTraining}
          className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300"
        >
          Train Keys
        </button>
      </div>
    </article>
  );
}
