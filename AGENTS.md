# AGENTS.md — FM27 Tactics Generator (Monorepo)

## Arsitektur & Batasan Utama
- Monorepo: `pnpm` + Turborepo (`apps/web` = Next.js 15 App Router + Zustand, `packages/fm-codec` = pure TS binary codec, `packages/fm-engine` = pure deterministic analytics, `packages/fm-data` = dataset statis FM27).
- **Aturan 0% Halusinasi (Wajib):** Seluruh rekomendasi Formasi, Squad Audit/Blueprint, Training, Staff Star, dan Wonderkids WAJIB 100% deterministik dari `packages/fm-engine` + `packages/fm-data` atau data asli file `.fm`/`.fmf`. DILARANG memanggil LLM/AI atau mengarang data pemain/staf.

## Aturan Codec Biner (.fmf & .fm)
- `.fmf` (ukuran kecil <100 KB): dukung header `fmf.` dan `afe.`, prefix `cat.` sebelum `PlanHeader` (`22 44`), penanda `LLUN`, 22 slot IP/OOP, dan `_data/details.aom`. Jalankan di main-thread atau wajib punya fallback instan bila Web Worker gagal/`DataCloneError` (`BigInt`).
- `.fm` (ukuran besar 50–400 MB): DILARANG dikirim ke API route/server (limit Vercel 4,5 MB). Wajib diproses 100% client-side di Web Worker menggunakan `Transferable ArrayBuffer` + `fzstd` pure TS.
- DILARANG membuka file biner `.fmf`/`.fm` dengan tool pembaca teks; inspeksi biner hanya lewat skrip Node.js/Vitest.
- DILARANG ada `catch` kosong/diam. Setiap kegagalan impor/ekspor wajib memunculkan notifikasi UI dengan pesan jelas.

## Aturan Hemat Token & Verifikasi
- JANGAN scan seluruh repositori dan JANGAN baca `MASTER_SPEC.md`, `docs/`, atau `supabase/` kecuali diminta secara spesifik.
- JANGAN instal dependensi baru atau menjalankan Playwright tanpa izin eksplisit.
- Gunakan verifikasi terfokus sesuai paket yang diubah:
  - Typecheck web: `pnpm --filter web typecheck`
  - Unit test spesifik: `pnpm vitest run <path-test>`
- Selalu pastikan `git status` bersih dari folder sementara (`/tmp/...`) sebelum commit.
