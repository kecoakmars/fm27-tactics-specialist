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

export function localizeAutoFixText(
  autoFix: NonNullable<StructuralGapAlert["autoFix"]>,
  locale: AppLocale,
): string {
  if (autoFix.group === "TriggerPress" && autoFix.toBit === 66) {
    return locale === "id"
      ? "Trigger Press → More Often (tekanan lebih terukur sesuai stamina)"
      : "Trigger Press → More Often (more selective pressing triggers)";
  }
  if (autoFix.group === "BuildUpStrategy" && autoFix.toBit === 0) {
    return locale === "id"
      ? "Build-up Strategy → Standard (opsi umpan aman saat ditekan)"
      : "Build-up Strategy → Standard (safer outlet under pressure)";
  }
  if (autoFix.group === "Crossing" && autoFix.toBit === 12) {
    return locale === "id"
      ? "Crossing → Low Crosses (umpan silang mendatar tanpa target udara)"
      : "Crossing → Low Crosses (cutbacks without an aerial target)";
  }
  return autoFix.text;
}

const COACHING_ALERT_TRANSLATIONS: Readonly<
  Record<
    string,
    {
      id: { title: string; detail: string };
      en: { title: string; detail: string };
    }
  >
> = {
  "gap-zone14-vacuum": {
    id: {
      title: "Area Depan Kotak Penalti Kosong",
      detail:
        "Kurang pemain yang mengisi ruang di depan kotak penalti lawan saat menyerang.",
    },
    en: {
      title: "Empty Edge of the Box",
      detail:
        "Few players occupy the central area outside the penalty box in possession.",
    },
  },
  "gap-flank-left": {
    id: {
      title: "Sayap Kiri Kurang Lebar",
      detail: "Sisi kiri minim dukungan lebar saat menguasai bola.",
    },
    en: {
      title: "Narrow Left Flank",
      detail: "Limited attacking width on the left side in possession.",
    },
  },
  "gap-flank-right": {
    id: {
      title: "Sayap Kanan Kurang Lebar",
      detail: "Sisi kanan minim dukungan lebar saat menguasai bola.",
    },
    en: {
      title: "Narrow Right Flank",
      detail: "Limited attacking width on the right side in possession.",
    },
  },
  "gap-rest-defense-count": {
    id: {
      title: "Rawan Serangan Balik",
      detail: "Kurang dari 3 pemain bertahan di belakang saat menyerang.",
    },
    en: {
      title: "Vulnerable to Counter-Attacks",
      detail: "Fewer than 3 players stay back to protect against counters.",
    },
  },
  "gap-stretched-block": {
    id: {
      title: "Jarak Antarlini Terlalu Renggang",
      detail:
        "Pressing tinggi dengan garis pertahanan rendah membuka ruang besar di lini tengah.",
    },
    en: {
      title: "Stretched Team Shape",
      detail:
        "High press combined with a low defensive line leaves space in midfield.",
    },
  },
  "coaching-rest-defence": {
    id: {
      title: "Perlindungan di Belakang Serangan",
      detail:
        "Bek tengah dan gelandang bertahan perlu lebih sigap menutup ruang yang ditinggalkan bek sayap saat naik menyerang.",
    },
    en: {
      title: "Cover Behind the Attack",
      detail:
        "Centre-backs and holding players need stronger positioning to cover advancing full-backs.",
    },
  },
  "coaching-width": {
    id: {
      title: "Dukungan Lebar Sayap",
      detail:
        "Kedua sisi sayap membutuhkan kecepatan, stamina, atau umpan silang yang lebih merata untuk meregangkan pertahanan lawan.",
    },
    en: {
      title: "Width and Wide Support",
      detail:
        "Both flanks need stronger pace, stamina, or delivery to stretch the opposition defense.",
    },
  },
  "coaching-press": {
    id: {
      title: "Ketahanan Pressing Lini Depan",
      detail:
        "Stamina dan agresivitas pemain depan/tengah sedikit berat untuk menekan terus-menerus, disertai tuntutan kecepatan bek saat bola lolos.",
    },
    en: {
      title: "First Press and Supporting Line",
      detail:
        "Front and midfield stamina/work-rate are stretched for constant pressing, putting extra recovery pressure on the back line.",
    },
  },
  "coaching-block": {
    id: {
      title: "Kerapatan Blok Lini Tengah",
      detail:
        "Gelandang tengah/bertahan membutuhkan penempatan posisi dan tekel yang lebih disiplin untuk menutup jalur umpan tengah lawan.",
    },
    en: {
      title: "Midfield Screen and Compact Block",
      detail:
        "Central midfielders need stronger positioning and tackling to screen passing lanes in front of the defense.",
    },
  },
  "coaching-build-up": {
    id: {
      title: "Aliran Umpan dari Belakang",
      detail:
        "Bek atau gelandang jemput bola memiliki satu titik lemah pada umpan/ketenangan saat ditekan lawan dari dekat.",
    },
    en: {
      title: "Build-Up Connections",
      detail:
        "One or more defenders or deep midfielders may struggle with passing composure when pressed.",
    },
  },
  "coaching-wing-backs": {
    id: {
      title: "Daya Jelajah Bek Sayap",
      detail:
        "Bek sayap dituntut memiliki stamina, kecepatan kembali bertahan, dan akurasi umpan silang yang tinggi sepanjang laga.",
    },
    en: {
      title: "Wing-Backs and Recovery",
      detail:
        "Wing-backs require high stamina, crossing quality, and recovery speed to cover the entire flank.",
    },
  },
  "coaching-forwards": {
    id: {
      title: "Kombinasi Lini Depan",
      detail:
        "Pasangan penyerang membutuhkan keseimbangan antara pemain penghubung umpan dan pelari penembus garis belakang lawan.",
    },
    en: {
      title: "Forward Partnership",
      detail:
        "The front pair works best with both a link-up creator and a runner stretching the back line.",
    },
  },
  "coaching-transition": {
    id: {
      title: "Ancaman Serangan Balik Cepat",
      detail:
        "Transisi serangan balik membutuhkan pelari cepat di depan dan pengumpan yang langsung melihat celah begitu merebut bola.",
    },
    en: {
      title: "Counter-Attack Outlet",
      detail:
        "Quick counters rely on fast forward runners and teammates able to play an early vertical pass.",
    },
  },
  "coaching-direct": {
    id: {
      title: "Duel Bola Pertama & Bola Kedua",
      detail:
        "Umpan langsung ke depan membutuhkan target yang kuat menahan bola pertama serta gelandang terdekat yang siap menyambar bola kedua.",
    },
    en: {
      title: "First Ball and Second Ball",
      detail:
        "Direct play requires a strong target for the first ball and nearby runners to win the second ball.",
    },
  },
  "coaching-delivery": {
    id: {
      title: "Umpan Silang & Kehadiran di Kotak Penalti",
      detail:
        "Serangan sayap akan lebih tajam bila akurasi umpan silang diimbangi pergerakan dan duel udara penyerang di kotak penalti.",
    },
    en: {
      title: "Wide Delivery and Box Presence",
      detail:
        "Wide service is most dangerous when paired with strong movement and aerial presence in the box.",
    },
  },
  "ck-adj-press-TriggerPress": {
    id: {
      title: "Opsi Penyesuaian Intensitas Pressing",
      detail:
        "Jika stamina tim terkuras di babak kedua, turunkan frekuensi pressing agar bentuk pertahanan tetap rapat.",
    },
    en: {
      title: "Pressing Intensity Adjustment",
      detail:
        "If squad stamina drops late in matches, moderate pressing triggers to keep your defensive shape compact.",
    },
  },
  "ck-adj-build-BuildUpStrategy": {
    id: {
      title: "Opsi Keamanan Build-Up Bawah Tekanan",
      detail:
        "Jika bek sering kehilangan bola saat ditekan tinggi oleh lawan, kembalikan strategi build-up ke Standard.",
    },
    en: {
      title: "Safer Build-Up Option",
      detail:
        "If defenders are caught in possession against an aggressive press, switch build-up back to Standard.",
    },
  },
  "ck-adj-aerial-Crossing": {
    id: {
      title: "Opsi Umpan Silang Mendatar",
      detail:
        "Jika penyerang Anda kalah postur udara dari bek tengah lawan, gunakan umpan silang mendatar (Low Crosses).",
    },
    en: {
      title: "Low Crosses Option",
      detail:
        "When your striker lacks height against tall centre-backs, switch to Low Crosses for cutbacks.",
    },
  },
};

export function localizeTacticalAlert(
  alert: StructuralGapAlert,
  locale: AppLocale,
): { title: string; detail: string; autoFixText?: string } {
  const autoFixText = alert.autoFix
    ? localizeAutoFixText(alert.autoFix, locale)
    : undefined;

  const entry = COACHING_ALERT_TRANSLATIONS[alert.id];
  if (entry) {
    const picked = locale === "id" ? entry.id : entry.en;
    return {
      title: picked.title,
      detail: picked.detail,
      ...(autoFixText !== undefined ? { autoFixText } : {}),
    };
  }

  const cleanTitle = alert.title
    .replace(/\s*\([^)]*target[^)]*\)/gi, "")
    .trim();
  return {
    title: cleanTitle,
    detail: alert.detail,
    ...(autoFixText !== undefined ? { autoFixText } : {}),
  };
}
