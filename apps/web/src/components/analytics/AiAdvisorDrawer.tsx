"use client";

import React, { useRef, useState } from "react";
import type { Player } from "@fm27/shared-types";
import { useTacticStore } from "@/stores/useTacticStore";

export interface AiAdvisorDrawerProps {
  open: boolean;
  onClose: () => void;
  squad?: Player[];
}

interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelUsed?: string;
  fallback?: boolean;
}

const QUICK_PROMPTS = [
  {
    id: "audit-weaknesses",
    label: "Audit Kelemahan",
    prompt:
      "Audit kelemahan struktural taktik ini di fase IP, OOP, Zone 14, dan transisi beserta penyesuaian instruksi paling berdampak.",
  },
  {
    id: "counter-433",
    label: "Counter 4-3-3 Gegenpress",
    prompt:
      "Bagaimana cara menyesuaikan taktik ini untuk meredam lawan yang memakai 4-3-3 Gegenpress garis tinggi?",
  },
  {
    id: "underdog-adjust",
    label: "Sesuaikan untuk Tim Underdog",
    prompt:
      "Sesuaikan mentality, line of engagement, dan duty pemain agar taktik ini aman dipakai tim underdog saat tandang.",
  },
] as const;

export function AiAdvisorDrawer({ open, onClose, squad }: AiAdvisorDrawerProps) {
  const { tactic } = useTacticStore();
  const [tier, setTier] = useState<"standard" | "deep">("standard");
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [previousInteractionId, setPreviousInteractionId] = useState<string | undefined>(
    undefined,
  );
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  if (!open) return null;

  const sendPrompt = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || streaming) return;

    const userTurnId = `u-${Date.now()}`;
    const assistantTurnId = `a-${Date.now() + 1}`;
    setInput("");
    setStreaming(true);

    setTurns((prev) => [
      ...prev,
      { id: userTurnId, role: "user", content: trimmed },
      { id: assistantTurnId, role: "assistant", content: "" },
    ]);

    try {
      const response = await fetch("/api/ai/tactical-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          tactic,
          ...(squad && squad.length >= 11 ? { squad } : {}),
          ...(previousInteractionId ? { previousInteractionId } : {}),
          tier,
        }),
      });

      if (!response.ok || !response.body) {
        const errBody = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || `Request failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const eventMatch = frame.match(/^event:\s*(\S+)/m);
          const dataMatch = frame.match(/^data:\s*(.+)$/m);
          if (!eventMatch || !dataMatch) continue;

          const eventType = eventMatch[1];
          const payload = JSON.parse(dataMatch[1]!) as {
            text?: string;
            interactionId?: string;
            modelUsed?: string;
            fallback?: boolean;
            message?: string;
          };

          if (eventType === "delta" && payload.text) {
            setTurns((prev) =>
              prev.map((t) =>
                t.id === assistantTurnId
                  ? {
                      ...t,
                      content: t.content + payload.text!,
                      modelUsed: payload.modelUsed,
                      fallback: payload.fallback,
                    }
                  : t,
              ),
            );
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
          } else if (eventType === "done") {
            if (payload.interactionId && !payload.fallback) {
              setPreviousInteractionId(payload.interactionId);
            }
          } else if (eventType === "error") {
            throw new Error(payload.message || "Streaming error");
          }
        }
      }
    } catch (err) {
      setTurns((prev) =>
        prev.map((t) =>
          t.id === assistantTurnId
            ? {
                ...t,
                content: `Error: ${err instanceof Error ? err.message : "Failed to reach tactical advisor"}`,
              }
            : t,
        ),
      );
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <aside
        aria-label="AI Tactical Assistant"
        className="w-full max-w-lg h-full bg-[#111827] border-l border-white/12 flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="px-5 py-4 bg-[#0B0F19] border-b border-white/10 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold text-slate-100">
              AI Tactical Analyst (Interactions API)
            </h2>
            <p className="text-[11px] text-slate-400 font-mono-metric">
              Context: IP {tactic.inFormation} → OOP {tactic.outFormation}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              id="ai-model-tier-select"
              value={tier}
              onChange={(e) => {
                setTier(e.target.value as "standard" | "deep");
                setPreviousInteractionId(undefined);
              }}
              className="px-2 py-1 rounded-lg bg-[#111827] border border-white/12 text-[11px] font-bold text-cyan-300 cursor-pointer"
            >
              <option value="standard">gemini-4-hydrogen (Live)</option>
              <option value="deep">gemini-4-neon (Deep Audit)</option>
            </select>

            <button
              id="close-ai-drawer-btn"
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        {/* Quick Prompts */}
        <div className="px-5 py-3 border-b border-white/8 flex flex-wrap gap-1.5 bg-[#0B0F19]/50">
          {QUICK_PROMPTS.map((qp) => (
            <button
              key={qp.id}
              id={`ai-quick-${qp.id}`}
              type="button"
              disabled={streaming}
              onClick={() => void sendPrompt(qp.prompt)}
              className="px-2.5 py-1 rounded-md text-xs font-semibold bg-cyan-500/14 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/24 transition cursor-pointer disabled:opacity-50"
            >
              {qp.label}
            </button>
          ))}
        </div>

        {/* Multi-Turn Stream Transcript */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-5 flex flex-col gap-3"
        >
          {turns.length === 0 ? (
            <div className="rounded-xl p-4 bg-[#0B0F19]/80 border border-white/8 text-xs text-slate-400 leading-relaxed">
              Select a quick prompt above or ask any tactical question. Turn 1 automatically
              injects the full deterministic `fm-engine` JSON snapshot (formations, roles, 18-zone
              Zone 14 &amp; Half-Space metrics, and UEFA/FIFA structural findings) so responses
              never hallucinate.
            </div>
          ) : (
            turns.map((turn) => (
              <div
                key={turn.id}
                className={`rounded-xl p-3.5 text-xs leading-relaxed whitespace-pre-wrap ${
                  turn.role === "user"
                    ? "bg-cyan-500/15 border border-cyan-500/30 text-slate-100 ml-8"
                    : "bg-[#0B0F19] border border-white/10 text-slate-200 mr-4"
                }`}
              >
                {turn.role === "assistant" && turn.modelUsed && (
                  <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-white/8 text-[10px] font-mono-metric text-slate-400">
                    <span>{turn.modelUsed}</span>
                    <span>{turn.fallback ? "Local Deterministic Fallback" : "Gemini Stream"}</span>
                  </div>
                )}
                {turn.content || (streaming ? "Analyzing tactical structure..." : "")}
              </div>
            ))
          )}
        </div>

        {/* Chat Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendPrompt(input);
          }}
          className="p-4 bg-[#0B0F19] border-t border-white/10 flex items-center gap-2"
        >
          <input
            id="ai-chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask follow-up about roles, pressing traps, or opponent shape..."
            className="flex-1 px-3 py-2 rounded-lg bg-[#111827] border border-white/15 text-xs text-slate-100 placeholder:text-slate-500"
          />
          <button
            id="ai-chat-submit-btn"
            type="submit"
            disabled={streaming || !input.trim()}
            className="px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-45 cursor-pointer"
          >
            Send
          </button>
        </form>
      </aside>
    </div>
  );
}
