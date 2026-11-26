"use client";

import { create } from "zustand";
import type { StructuralGapAlert } from "@fm27/fm-engine";

export type AppLocale = "id" | "en";

const STORAGE_KEY = "fm27-locale";

interface LocaleState {
  locale: AppLocale;
  hydrated: boolean;
  setLocale: (locale: AppLocale) => void;
  toggleLocale: () => void;
  hydrateLocale: () => void;
}

export const useLocaleStore = create<LocaleState>((set, get) => ({
  locale: "id",
  hydrated: false,
  setLocale: (locale) => {
    set({ locale, hydrated: true });
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, locale);
        document.documentElement.lang = locale;
      } catch {
        // Ignore storage quota / privacy mode errors
      }
    }
  },
  toggleLocale: () => {
    const next: AppLocale = get().locale === "id" ? "en" : "id";
    get().setLocale(next);
  },
  hydrateLocale: () => {
    if (get().hydrated || typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      const resolved: AppLocale = saved === "en" ? "en" : "id";
      document.documentElement.lang = resolved;
      set({ locale: resolved, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
}));

export function useLocale() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const toggleLocale = useLocaleStore((s) => s.toggleLocale);
  const hydrateLocale = useLocaleStore((s) => s.hydrateLocale);
  const t = <T,>(idVal: T, enVal: T): T => (locale === "id" ? idVal : enVal);
  return { locale, setLocale, toggleLocale, hydrateLocale, t };
}

export function tr<T>(idVal: T, enVal: T): T {
  return useLocaleStore.getState().locale === "id" ? idVal : enVal;
}

export function formatFmSaveStage(pct: number, locale: AppLocale): string {
  if (pct < 15) {
    return locale === "id" ? "Membuka file karier..." : "Opening career save...";
  }
  if (pct < 35) {
    return locale === "id" ? "Membaca database karier..." : "Reading career database...";
  }
  if (pct < 88) {
    return locale === "id"
      ? "Memuat klub, pemain & staf pelatih..."
      : "Loading clubs, players & staff...";
  }
  if (pct < 100) {
    return locale === "id"
      ? "Menyusun taktik terbaik klub..."
      : "Preparing best tactic for your club...";
  }
  return locale === "id" ? "Selesai!" : "Ready!";
}

export function localizeTacticalAlert(
  alert: StructuralGapAlert,
  locale: AppLocale,
): { title: string; detail: string } {
  if (alert.id === "gap-zone14-vacuum") {
    return locale === "id"
      ? {
          title: "Area Depan Kotak Penalti Kosong",
          detail:
            "Kurang pemain yang mengisi ruang di depan kotak penalti lawan saat menyerang.",
        }
      : {
          title: "Empty Edge of the Box",
          detail:
            "Few players occupy the central area outside the penalty box in possession.",
        };
  }
  if (alert.id === "gap-flank-left") {
    return locale === "id"
      ? {
          title: "Sayap Kiri Kurang Lebar",
          detail: "Sisi kiri minim dukungan lebar saat menguasai bola.",
        }
      : {
          title: "Narrow Left Flank",
          detail: "Limited attacking width on the left side in possession.",
        };
  }
  if (alert.id === "gap-flank-right") {
    return locale === "id"
      ? {
          title: "Sayap Kanan Kurang Lebar",
          detail: "Sisi kanan minim dukungan lebar saat menguasai bola.",
        }
      : {
          title: "Narrow Right Flank",
          detail: "Limited attacking width on the right side in possession.",
        };
  }
  if (alert.id === "gap-rest-defense-count") {
    return locale === "id"
      ? {
          title: "Rawan Serangan Balik",
          detail:
            "Kurang dari 3 pemain bertahan di belakang saat menyerang.",
        }
      : {
          title: "Vulnerable to Counter-Attacks",
          detail: "Fewer than 3 players stay back to protect against counters.",
        };
  }
  if (alert.id === "gap-stretched-block") {
    return locale === "id"
      ? {
          title: "Jarak Antarlini Terlalu Renggang",
          detail:
            "Pressing tinggi dengan garis pertahanan rendah membuka ruang besar di lini tengah.",
        }
      : {
          title: "Stretched Team Shape",
          detail:
            "High press combined with a low defensive line leaves space in midfield.",
        };
  }
  // Strip numeric target parenthetical e.g. " (12.1 vs target 14)" for cleaner FM coaching presentation
  const cleanTitle = alert.title.replace(/\s*\([^)]*target[^)]*\)/gi, "").trim();
  return { title: cleanTitle, detail: alert.detail };
}
