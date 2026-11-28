# HANDOFF.md — FM27 Tactics Studio (Cloud Session Continuation)

- **Branch Aktif:** `main`
- **Status Terkini:** Seluruh fitur inti Tahap 1–5 beserta `Efektivitas` Per Pemain asli dari `.fm` (10-bar gaya FM27), pratinjau kartu taktik PNG kaya informasi, dan perapian toolbar Papan Taktik sudah live di `origin/main` (Vercel auto-deploy), bersih dari bug/error aktif (`typecheck`, `vitest`, dan `next build` lulus hijau).
- **Arsitektur Monorepo:** `pnpm` (`pnpm@12.21.0`, Node `>=22`) + Turborepo
  - `apps/web`: Next.js 15 App Router + React 19 + Tailwind + Zustand (`zundo` temporal Undo/Redo)
  - `packages/fm-codec`: Pure TypeScript binary codec untuk `.fmf` (taktik, jadwal `.tsc`, shortlist `.slf`) & `.fm` (save karier Zstandard via `fzstd`)
  - `packages/fm-engine`: Mesin analitik 100% deterministik (Hungarian solver, evaluasi peran IP/OOP, audit skuad, kalkulator bintang staf, perencana latihan, ranking wonderkid)
  - `packages/fm-data`: Dataset statis FM27 (`versions/v27.0/`) dengan validasi checksum SHA-256 LF-normalized
  - `packages/shared-types`: Kontrak tipe lintas-paket

---

## Aturan Pemeliharaan `HANDOFF.md` (Wajib Dipatuhi Setiap Sesi)

1. **Maksimal 4 Sesi Update Terbaru (Rolling 4 / FIFO):**
   - Bagian **Riwayat 4 Sesi Update Terbaru** di bawah hanya boleh memuat **maksimal 4 sesi update terakhir** (diurutkan dari #1 paling baru di atas hingga #4 paling lama di bawah).
   - Apabila sudah terisi 4 sesi dan ada sesi update baru, **riwayat update yang paling terakhir/terlama (urutan ke-4) wajib otomatis dihapus** saat menambahkan sesi terbaru di urutan ke-1.
2. **Jangan Tulis Bagian Bug/Error Jika Bersih:**
   - Jika tidak ditemukan bug atau error aktif pada aplikasi, test, maupun build, **tidak perlu menulis bagian Bug/Error** sama sekali. Bagian kendala/bug hanya ditulis apabila memang ada masalah nyata yang belum terselesaikan.

---

## 1. Riwayat 4 Sesi Update Terbaru

1. **Sesi Update #1 (Terbaru — `e553356` + sesi ini | 2026-11-28) — Efektivitas Per Pemain Asli `.fm` (10-Bar FM27), Indikator Taktik Live, & Upgrade Kartu PNG + Pratinjau:**
   - **Ekstraksi In-Game Familiarity & Fisik dari `.fm` (`fm-save-parser.ts`):** Mengekstrak 9 byte *signed familiarity* bulanan (`-100..+50`) beserta *Condition* (`rec+106`) dan *Match Sharpness* (`rec+110`) untuk seluruh pemain klub, serta membangun ulang standalone worker `/workers/fm-save-worker.js`.
   - **Efektivitas Per Pemain & 10-Bar Segmen Gaya FM27 (`tactical-metrics.ts`, `FamiliaritySegmentsBar.tsx`):** Menggabungkan *familiarity* asli `.fm` dengan kecocokan peran IP/OOP & instruksi tim aktif per pemain pada token lapangan, inspektor Papan Taktik, dan tabel Skuad (`/squad`), sementara bar Efektivitas tim menghitung rata-rata 11 starter.
   - **Perapian Toolbar Papan Taktik & Pratinjau Gambar PNG (`page.tsx`, `svg-card-exporter.ts`, `TacticPngPreviewModal.tsx`):** Menghapus tombol redundan `Ringkasan →` di toolbar Papan Taktik, mengubah tombol `Undo`/`Redo` menjadi ikon simbol, serta meng-upgrade output `Gambar PNG` menjadi poster taktik 2400×1350 lengkap (penjelasan cara kerja taktik, instruksi IP/Transisi/OOP, 6 pilar keseimbangan, daftar 11 starter) dengan modal pratinjau & tombol salin gambar sebelum diunduh.

2. **Sesi Update #2 (`218d957`, `d6f8287`, `e2ccd05` | 2026-11-27) — Ringkasan Instruksi Tim, Toggle Minimize, & Lokalisasi Penuh Catatan Taktis `ID | EN`:**
   - **Ringkasan Instruksi Tim Aktif (`218d957`):** Menambahkan komponen `ActiveTeamInstructionsSummary.tsx` di halaman utama `/`, tab Formasi `UnifiedReportDashboard.tsx`, dan `/squad` untuk menampilkan ringkasan teks *Mentality* serta instruksi aktif *Saat Menguasai Bola (IP)* & *Saat Bertahan (OOP)* secara ringkas (otomatis melewati opsi default *Standard/Balanced*).
   - **Toggle `Minimize ▴` / `Buka Ringkasan ▾` (`d6f8287`):** Mengganti tombol *Close/Tutup* permanen pada `UnifiedReportDashboard.tsx` (`unifiedReportMinimized` di `useTacticStore.ts`) menjadi tombol *Minimize/Expand* sehingga panel 5-tab dapat diperkecil menjadi bar skor ringkas tanpa hilang permanen.
   - **Pelokalan Penuh Catatan Taktis (`e2ccd05`):** Melengkapi `localizeTacticalAlert` di `useLocaleStore.ts` agar seluruh peringatan/temuan taktis di `CoachingFindingsList.tsx` dan `UnifiedReportDashboard.tsx` beserta label tombol perbaikan otomatis tampil utuh dalam Bahasa Indonesia maupun English (`ID | EN`).

3. **Sesi Update #3 (`a3b21e0` | 2026-11-26) — Pemfokusan `README.md` Publik untuk Pemain FM27:**
   - Merapikan halaman depan `README.md` GitHub agar fokus sepenuhnya pada deskripsi produk, 7 fitur utama, dan keunggulan aplikasi bagi pemain Football Manager 27 tanpa mencampur dokumentasi teknis internal.

4. **Sesi Update #4 (Terlama di Antrean 4 — `5581f41`, `8842093` | 2026-11-26) — Legenda Warna Papan Taktik Ringkas (`ID | EN`) & Sinkronisasi Rilis Uji Komunitas:**
   - Menambahkan baris keterangan warna kompak (`PitchColorLegend` di `Heatmap18Zone.tsx` & `page.tsx`) tepat di bawah lapangan untuk menjelaskan arti warna lingkaran pemain (Biru IP, Oranye OOP, Hijau Kiper) serta warna kotak kepadatan area (`≥70%`, `40–69%`, `<40%`, dan kotak garis putus depan penalti) sesuai mode `Area` aktif.
   - Memperbarui `CHANGELOG.md` (`v1.1.0`) untuk kesiapan pengujian save komunitas.

---

## 2. Fondasi Utama Sistem yang Sudah Berjalan

1. **Codec Biner `.fmf` Akurat & Round-Trip Valid:**
   - Mendukung arsip `fmf.` dan `afe.` (AES-CTR), prefix `cat.` sebelum `PlanHeader` (`22 44`), penanda `LLUN`, permutasi lintas-fase `PHASE_ORDER` (22 slot IP/OOP akurat), bitmask 43-bit *Player Instructions*, trailer set-piece, serta `_data/details.aom` v3/XML v2. Berjalan instan di *main-thread* untuk file `<100 KB`.
2. **Parser Save Karier `.fm` (50–400 MB) 100% Client-Side di Standalone Web Worker:**
   - Bundel IIFE mandiri `apps/web/public/workers/fm-save-worker.js` (`scripts/build-save-worker.mjs`) dengan protokol `PING -> PONG`, fallback `Blob Worker`, *Transferable ArrayBuffer*, watchdog `90s`, dan tombol batal instan. Mengekstrak klub, pemisahan skuad (`First Team`, `U21`, `U18`), atribut skala `1–20`, 8 atribut *personality*, staf pelatih klub, **500 Live U-21 Wonderkids**, dan **200 Live Staff / Free Agents**.
3. **Mesin Rekomendasi Deterministik Terkalibrasi REA (0% Kebocoran Data Sample):**
   - Isolasi `First Team`, kurasi kandidat peran `getSolverCandidateRolesForSlot`, kecocokan kaki dominan bek/gelandang tengah, *unique bench cover* 1-ke-1, serta *empty state* bersih sebelum file `.fm` dimuat.
4. **Satu Pintu Impor Pintar & Dwi-Bahasa `ID | EN`:**
   - Router terpusat `importAnySupportedFile` (`file-importer.ts`) di `TopNavShell.tsx` menyinkronkan otomatis Papan Taktik, Skuad, Jadwal Latihan 7×3, Staf Pelatih, dan target Wonderkids dalam satu unggahan, dilengkapi switch instan **`ID | EN`** (`useLocaleStore.ts`) bebas jargon teknis/rumus internal.

---

## 3. Keputusan Teknis & Arsitektur Penting (Termasuk yang Sengaja Dihindari)

1. **Wajib 0% Halusinasi / 0% LLM untuk Rekomendasi Taktik & Skuad:**
   - Seluruh rekomendasi formasi, kecocokan pemain, latihan, bintang staf, dan wonderkids **wajib 100% deterministik** dari `@fm27/fm-engine` + `@fm27/fm-data` atau biner `.fm`/`.fmf` asli. Dilarang memanggil API LLM atau mengarang data pemain/staf.
2. **Batas Ketat Pemrosesan File `.fm` (Client-Side Worker Saja):**
   - Dilarang mengunggah `.fm` ke API route/server (batas Vercel 4,5 MB), dilarang dekompresi `.fm` di *main-thread*, dilarang memakai module worker Webpack `new URL(..., import.meta.url)` untuk `.fm`, dan dilarang meng-commit file `*.fm` atau folder sementara (`/tmp`, `_reference`, dll.) ke Git.
3. **Prinsip Copywriting UI untuk Pemain Football Manager:**
   - Gunakan istilah sepak bola/FM yang ringkas dan familier (`ID | EN`); jangan menampilkan opsi `.fm27.json`/`CSV`/`HTML`, istilah algoritma internal (`Mode A/B/C`, `Hungarian`, `DDM`, `0% AI`), maupun rumus matematika di layar.
4. **Inspeksi File Biner & Disiplin Verifikasi:**
   - Dilarang membuka `.fm`/`.fmf` dengan pembaca teks biasa (gunakan skrip Node.js/Vitest). Jangan instal dependensi baru atau menjalankan Playwright tanpa izin eksplisit.

---

## 4. Urutan Langkah Kerja Berikutnya

1. **Evaluasi Hasil Uji File Save `.fm` dari Komunitas:**
   - Pantau skenario *edge-case*: save manajer menganggur (*Unemployed*)/Timnas (otomatis buka `ClubPickerModal`), klub kasta bawah berskuad tipis (`<11` pemain `First Team` -> fallback gabungan U21/U18), save karier musim jauh (2032+ regen/newgen & ukuran `150–400 MB`), serta keseimbangan rekomendasi gaya pragmatis untuk klub kecil.
2. **Bangun *First-Launch Onboarding* Ringkas (`ID | EN`):**
   - Modal panduan singkat 3 langkah yang hanya muncul pada kunjungan pertama (`localStorage` mis. `fm27-onboarding-seen-v1` + tombol `?` di `TopNavShell`): *(1) Muat `.fm`/`.fmf` -> (2) Atur IP/OOP & Cek Skuad/Latihan -> (3) Unduh `.fmf` ke FM27*.
3. **Persistensi Sesi `.fm` di `IndexedDB` (Opsional / High-UX Impact):**
   - Simpan ringkasan ekstraksi `ParsedFmSave` ke `IndexedDB` browser agar data klub/pemain/wonderkids tidak hilang saat halaman di-refresh (`F5`), lengkap dengan tombol *Hapus/Ganti Save*.
4. **Baseline Verifikasi Cepat Setiap Sesi:**
   ```bash
   pnpm data:validate && pnpm typecheck && pnpm test && pnpm --filter @fm27/web build
   ```

---

## 5. Daftar File Utama yang Harus Dicek Lebih Dulu

### Aturan & Konfigurasi Proyek
1. `AGENTS.md` & `package.json` — Aturan wajib proyek dan skrip workspace (`worker:build`, `data:validate`, `typecheck`, `test`, `build`).

### State Global, Lokalisasi & Impor File (`apps/web`)
2. `apps/web/src/stores/useTacticStore.ts` — Pusat state taktik aktif, sesi live `.fm`, state `unifiedReportMinimized`, dan sinkronisasi lintas-store.
3. `apps/web/src/stores/useLocaleStore.ts` — Store dwi-bahasa `ID | EN`, helper `useLocale()` / `tr()`, dan `localizeTacticalAlert`.
4. `apps/web/src/lib/file-importer.ts`, `apps/web/src/lib/worker-client.ts`, & `scripts/build-save-worker.mjs` — Router impor tunggal `.fm`/`.fmf` dan orkestrasi standalone Web Worker `/workers/fm-save-worker.js`.

### Komponen UI Utama (`apps/web`)
5. `apps/web/src/components/TopNavShell.tsx` & `apps/web/src/components/ClubPickerModal.tsx` — Navbar global, tombol `Muat .fm / .fmf`, pemilih klub karier, dan switch `ID | EN`.
6. `apps/web/src/app/page.tsx`, `apps/web/src/components/analytics/UnifiedReportDashboard.tsx`, `apps/web/src/components/instructions/ActiveTeamInstructionsSummary.tsx`, `apps/web/src/components/analytics/CoachingFindingsList.tsx`, & `apps/web/src/components/analytics/Heatmap18Zone.tsx` — Workspace Papan Taktik IP/OOP, panel ringkasan 5-tab dengan minimize, ringkasan instruksi aktif, catatan taktis terlokalisasi, dan legenda warna lapangan.
7. `apps/web/src/app/squad/page.tsx`, `apps/web/src/app/wonderkids/page.tsx`, `apps/web/src/app/staff/page.tsx`, & `apps/web/src/app/training/page.tsx` — Empat halaman modul klub yang tersinkron ke `useTacticStore`.

### Mesin Analitik & Codec Biner (`packages/*` & `tests/*`)
8. `packages/fm-engine/src/unified-analyzer.ts`, `packages/fm-engine/src/squad-analyzer.ts`, `packages/fm-engine/src/role-evaluator.ts`, & `packages/fm-engine/src/hungarian.ts` — Orkestrator 5 rekomendasi, isolasi `First Team`, kurasi peran, dan solver Hungarian.
9. `packages/fm-codec/src/fm-save-parser.ts`, `packages/fm-codec/src/fmf-archive.ts`, & `packages/fm-codec/src/tac-serializer.ts` — Parser biner save `.fm` Zstd serta codec `.fmf`/`.tac`.
10. `tests/unified-analyzer.spec.ts`, `tests/fm-save-parser.spec.ts`, `tests/codec.spec.ts`, & `tests/production-phase6.spec.ts` — Suite pengujian regresi utama.
