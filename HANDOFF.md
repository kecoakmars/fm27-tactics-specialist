# HANDOFF.md — FM27 Tactics Studio (Cloud Session Continuation)

- **Branch Aktif:** `main`
- **Status Terkini:** Seluruh fitur Tahap 1 beserta kalibrasi 3 Indikator Taktik ke skala asli FM27 (`Efektivitas` per pemain 10-bar `(byte + 100) / 2` dari `.fm`, `Intensitas` & `Kompleksitas` 8-segmen ramah pemula), perapian toolbar Papan Taktik, dan poster kartu `Gambar PNG` HD dengan modal pratinjau sudah live di `origin/main` (`e553356`, `fddd1be`, `b0fb103`), bersih dari bug/error aktif (`data:validate`, `typecheck`, `vitest 51/51`, dan `next build` lulus hijau).
- **Arsitektur Monorepo:** `pnpm` (`pnpm@12.21.0`, Node `>=22`) + Turborepo
  - `apps/web`: Next.js 15 App Router + React 19 + Tailwind + Zustand (`zundo` temporal Undo/Redo)
  - `packages/fm-codec`: Pure TypeScript binary codec untuk `.fmf` (taktik, jadwal `.tsc`, shortlist `.slf`) & `.fm` (save karier Zstandard via `fzstd`)
  - `packages/fm-engine`: Mesin analitik 100% deterministik (Hungarian solver, evaluasi peran IP/OOP, audit skuad, indikator taktik FM27, kalkulator bintang staf, perencana latihan, ranking wonderkid)
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

1. **Sesi Update #1 (Terbaru — `e553356`, `fddd1be`, `b0fb103` | 2026-11-28) — Tahap 1 (Tab Ringkasan & Pencari Taktik), Kalibrasi 3 Indikator Skala FM27 Asli, & Upgrade Kartu PNG + Pratinjau:**
   - **Tahap 1 UI & Navigasi (`e553356`):** Menempatkan tab **Ringkasan (`/summary`)** di urutan paling awal `TopNavShell.tsx`, menghadirkan `TacticRecommendationPanel.tsx` di Papan Taktik & Ringkasan, serta mengganti label `Wonderkids` menjadi **`Shortlist`**.
   - **Ekstraksi In-Game Familiarity `.fm` & Kalibrasi 3 Indikator Ramah Pemula (`fddd1be`, `b0fb103`):** Mengekstrak 9 byte *signed familiarity* (`-100..+100`) beserta *Condition* (`rec+106`) & *Match Sharpness* (`rec+110`) di `fm-save-parser.ts` (cache-buster worker `?v=3`), mengalibrasi `Efektivitas` ke skala asli SI `(nilai + 100) / 2` (`1–10` bar di Papan Taktik, token pemain, & tabel Skuad), serta menyajikan `Intensitas Fisik` & `Kompleksitas` (`1–8` segmen) dengan penjelasan praktis bebas jargon di `TacticalIndicatorsBar.tsx`.
   - **Perapian Toolbar & Kartu Taktik PNG HD dengan Pratinjau (`fddd1be`, `b0fb103`):** Menghapus tombol redundan `Ringkasan →` di Papan Taktik, mengubah `Undo`/`Redo` menjadi ikon simbol, dan meng-upgrade tombol `Gambar PNG` menjadi modal pratinjau `TacticPngPreviewModal.tsx` (`2400×1350` HD lengkap dengan identitas cara kerja sistem IP→OOP, instruksi aktif per fase, 6 pilar keseimbangan, daftar 11 starter, opsi sembunyikan nama pemain, & salin gambar ke clipboard).

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
   - Bundel IIFE mandiri `apps/web/public/workers/fm-save-worker.js` (`?v=3`, dibangun via `scripts/build-save-worker.mjs`) dengan protokol `PING -> PONG`, fallback `Blob Worker`, *Transferable ArrayBuffer*, watchdog `90s`, dan tombol batal instan. Mengekstrak klub, pemisahan skuad (`First Team`, `U21`, `U18`), atribut skala `1–20`, 8 atribut *personality*, 9 byte *in-game tactical familiarity* (`-100..+100`), *Condition* & *Match Sharpness*, staf pelatih klub, **500 Live U-21 Wonderkids**, dan **200 Live Staff / Free Agents**.
3. **Mesin Rekomendasi & Indikator Taktik Deterministik Terkalibrasi FM27:**
   - Isolasi `First Team`, kurasi kandidat peran `getSolverCandidateRolesForSlot`, kecocokan kaki dominan bek/gelandang tengah, *unique bench cover* 1-ke-1, serta 3 indikator taktik live (`Intensitas Fisik` 8-segmen, `Kompleksitas` 8-segmen, `Efektivitas` 10-bar per pemain & rata-rata starter tanpa inflasi buatan).
4. **Satu Pintu Impor Pintar, Ekspor Kartu PNG HD, & Dwi-Bahasa `ID | EN`:**
   - Router terpusat `importAnySupportedFile` (`file-importer.ts`) di `TopNavShell.tsx`, pratinjau poster taktik PNG `2400×1350` (`svg-card-exporter.ts`, `TacticPngPreviewModal.tsx`), serta switch instan **`ID | EN`** (`useLocaleStore.ts`) ramah pemain pemula maupun veteran.

---

## 3. Keputusan Teknis & Arsitektur Penting (Termasuk yang Sengaja Dihindari)

1. **Wajib 0% Halusinasi / 0% LLM / Tanpa Cheat Familiarity Instan:**
   - Seluruh rekomendasi formasi, kecocokan pemain, indikator taktik, latihan, bintang staf, dan shortlist **wajib 100% deterministik** dari `@fm27/fm-engine` + `@fm27/fm-data` atau biner `.fm`/`.fmf` asli. `Efektivitas` mencerminkan *familiarity* latihan nyata pemain di save `.fm` tanpa dimanipulasi menjadi instan `10/10`.
2. **Batas Ketat Pemrosesan File `.fm` (Client-Side Worker Saja):**
   - Dilarang mengunggah `.fm` ke API route/server (batas Vercel 4,5 MB), dilarang dekompresi `.fm` di *main-thread*, dilarang memakai module worker Webpack `new URL(..., import.meta.url)` untuk `.fm`, dan wajib menjalankan `pnpm worker:build` + menaikkan query `?v=` di `worker-client.ts` setiap kali `fm-save-parser.ts` diubah.
3. **Prinsip Copywriting UI Ramah Pemula (`ID | EN`):**
   - Gunakan bahasa sepak bola/FM yang jelas bagi pemula (`ID | EN`); hindari singkatan teknis mentah (`TI`, `PI`, `Mode A/B/C`, `Hungarian`, `DDM`, `0% AI`) di layar pengguna.
4. **Inspeksi File Biner & Disiplin Verifikasi:**
   - Dilarang membuka `.fm`/`.fmf` dengan pembaca teks biasa (gunakan skrip Node.js/Vitest). Jangan instal dependensi baru atau menjalankan Playwright tanpa izin eksplisit.

---

## 4. Urutan Langkah Kerja Berikutnya (Lanjutan Besok: Tahap 2 & Tahap 3)

1. **Tahap 2 — Integrasi Sub-Tab di Halaman `Skuad` (`Staf Pelatih` + `Analisa Tim Lawan`):**
   - **Sub-Tab `Staf Pelatih` di dalam `/squad`:** Pindahkan modul Staf Pelatih menjadi sub-tab di dalam halaman **Skuad** (rapikan tab utama di `TopNavShell.tsx`), tambahkan filter pencarian staf lengkap (*Negara/Liga*, *Jenis/Peran Staf*, *Free Agent*, *Nama*), serta tambahkan *checkbox/toggle* pada staf pelatih milik klub sendiri agar bisa dikecualikan/disembunyikan saat mencari staf rekrutan baru.
   - **Sub-Tab `Analisa Tim Lawan (Opposition Report & H2H Anti-Tactic)` di dalam `/squad`:** Deteksi lawan selanjutnya secara otomatis berdasarkan kalender save `.fm` (tampil kosong/jujur bila sedang jeda/libur musim, sesuai kesepakatan Kondisi 1) ditambah pemilih tim lawan manual dari daftar klub save `.fm`; tampilkan prediksi *Starting XI* & formasi terkuat lawan, 3 celah terlemah lawan, serta saran penyesuaian *anti-tactic* head-to-head.
2. **Tahap 3 — Perluasan `Shortlist` (Pemain Senior / Reguler / Free Agent + `Compare`):**
   - Perluas ekstraksi kolam pemain di `fm-save-parser.ts` dan halaman **Shortlist (`/wonderkids`)** agar selain *Wonderkids U-21* juga mendukung pencarian **pemain senior / reguler / Free Agent** lintas usia & posisi, lengkap dengan fitur **Compare (*Bandingkan Atribut & Kecocokan Peran*)** langsung melawan pemain di tim kita.
3. **Peningkatan Kualitas Sesi (Opsional Setelah Tahap 3):**
   - Persistensi sesi hasil ekstraksi `ParsedFmSave` ke `IndexedDB` browser agar data klub tidak hilang saat halaman di-refresh (`F5`), serta panduan singkat kunjungan pertama (*First-Launch Onboarding* `ID | EN`).
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
4. `apps/web/src/lib/file-importer.ts`, `apps/web/src/lib/worker-client.ts`, & `scripts/build-save-worker.mjs` — Router impor tunggal `.fm`/`.fmf` dan orkestrasi standalone Web Worker `/workers/fm-save-worker.js?v=3`.

### Komponen UI Utama (`apps/web`)
5. `apps/web/src/components/TopNavShell.tsx` & `apps/web/src/components/ClubPickerModal.tsx` — Navbar global (`Ringkasan` di tab pertama), tombol `Muat .fm / .fmf`, pemilih klub karier, dan switch `ID | EN`.
6. `apps/web/src/app/summary/page.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/components/analytics/TacticalIndicatorsBar.tsx`, `apps/web/src/components/analytics/FamiliaritySegmentsBar.tsx`, `apps/web/src/components/tactics/TacticRecommendationPanel.tsx`, `apps/web/src/components/tactics/TacticPngPreviewModal.tsx`, & `apps/web/src/lib/svg-card-exporter.ts` — Halaman Ringkasan, Papan Taktik IP/OOP, 3 indikator taktik ramah pemula, pencari taktik terbaik, serta pratinjau & ekspor kartu PNG HD.
7. `apps/web/src/app/squad/page.tsx`, `apps/web/src/components/squad/RoleFitTable.tsx`, `apps/web/src/app/wonderkids/page.tsx`, `apps/web/src/app/staff/page.tsx`, & `apps/web/src/app/training/page.tsx` — Halaman modul Skuad, Shortlist, Staf Pelatih, dan Latihan (target utama integrasi Tahap 2 & Tahap 3).

### Mesin Analitik & Codec Biner (`packages/*` & `tests/*`)
8. `packages/fm-engine/src/tactical-metrics.ts`, `packages/fm-engine/src/unified-analyzer.ts`, `packages/fm-engine/src/squad-analyzer.ts`, `packages/fm-engine/src/role-evaluator.ts`, & `packages/fm-engine/src/hungarian.ts` — Kalkulator 3 indikator taktik & Efektivitas per pemain, orkestrator 5 rekomendasi, dan solver Hungarian.
9. `packages/fm-codec/src/fm-save-parser.ts`, `packages/fm-codec/src/fmf-archive.ts`, & `packages/fm-codec/src/tac-serializer.ts` — Parser biner save `.fm` Zstd (termasuk familiarity 9-byte & fisik) serta codec `.fmf`/`.tac`.
10. `tests/unified-analyzer.spec.ts`, `tests/fm-save-parser.spec.ts`, `tests/engine.spec.ts`, `tests/web-phase2.spec.ts`, `tests/codec.spec.ts`, & `tests/production-phase6.spec.ts` — Suite pengujian regresi utama.
