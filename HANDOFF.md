# HANDOFF.md — FM27 Tactics Studio (Cloud Session Continuation)

- **Branch Aktif:** `main`
- **Status Terkini:** Tahap 1–5 + Optimasi Peran Skuad (`de14486`) + Legenda Warna Papan Taktik (`5581f41`) sudah live di `origin/main` (Vercel auto-deploy) dan siap untuk pengujian komunitas dengan berbagai file save `.fm`.
- **Arsitektur Monorepo:** `pnpm` (`pnpm@12.21.0`, Node `>=22`) + Turborepo
  - `apps/web`: Next.js 15 App Router + React 19 + Tailwind + Zustand (`zundo` temporal Undo/Redo)
  - `packages/fm-codec`: Pure TypeScript binary codec untuk `.fmf` (taktik, jadwal `.tsc`, shortlist `.slf`) & `.fm` (save karier Zstandard via `fzstd`)
  - `packages/fm-engine`: Mesin analitik 100% deterministik (Hungarian solver, evaluasi peran IP/OOP, audit skuad, kalkulator bintang staf, perencana latihan, ranking wonderkid)
  - `packages/fm-data`: Dataset statis FM27 (`versions/v27.0/`) dengan validasi checksum SHA-256 LF-normalized
  - `packages/shared-types`: Kontrak tipe lintas-paket

---

## 1. Ringkasan Fitur yang Sudah Selesai dan Berjalan

1. **Codec Biner `.fmf` Akurat & Round-Trip Valid (`5977b3b`, `bee549b`):**
   - Mendukung penuh arsip `fmf.` dan terenkripsi `afe.` (AES-CTR), prefix `cat.` sebelum `PlanHeader` (`22 44`), penanda `LLUN`, permutasi lintas-fase `PHASE_ORDER` (22 slot IP/OOP tidak lagi tertukar), slot `entryCount = 0 / 1 / 2` beserta bitmask 43-bit *Player Instructions*, trailer set-piece, serta metadata biner `_data/details.aom` v3 (`03 01 moa. 04 00`) dan XML v2.
   - Berjalan sinkron/instan di *main-thread* untuk file `<100 KB` (bebas kendala `DataCloneError` akibat `BigInt`) dan mengunduh file `<a download="NamaTaktik.fmf">` ter-sanitasi Windows atau menyimpan langsung ke folder lokal FM27 via *File System Access API*.

2. **Parser Save Karier `.fm` (50–400 MB) 100% Client-Side di Standalone Web Worker (`1cda60a`, `0129471`, `bee549b`):**
   - Mengekstrak langsung dari biner `game_db.dat` (Zstd): ribuan klub (termasuk deteksi otomatis klub manajer manusia), pemain per klub (normalisasi atribut internal `0–125` ke skala `1–20`, familiaritas posisi, CA, 8 atribut *personality* tersembunyi, dan pemisahan `First Team` vs `U21 / Reserve` vs `U18 / Youth`), staf pelatih per klub, **500 Live U-21 Wonderkids**, dan **200 Live Staff / Free Agents**.
   - Menggunakan bundel IIFE mandiri `apps/web/public/workers/fm-save-worker.js` (~106 KB, dibangun via `scripts/build-save-worker.mjs`) dengan protokol `PING -> PONG` (`15s` timeout), cache-busting `?v=2`, fallback otomatis `fetch() + Blob Worker` untuk CDN Vercel, *Transferable ArrayBuffer*, watchdog heartbeat `90s`, dan tombol pembatalan instan (masalah *stuck* di `3%` sudah tuntas).

3. **Mesin Rekomendasi Formasi, Skuad, Staf, Latihan & Wonderkids Deterministik — Terkalibrasi REA (`5977b3b`, `f208181`, `014b1d7`):**
   - **Isolasi Skuad Utama:** Solver otomatis mengisolasi pemain `First Team` (tidak mencampur 77 pemain U18/U21 ke hitungan starter & pelapis).
   - **Kurasi Peran & Kaki Dominan:** `getSolverCandidateRolesForSlot` membatasi peran *niche* (seperti `OP*Outlet*` pada gaya *High-Press* atau `NoNonsenseCentreBack` pada tim penguasaan bola), memberi kompensasi familiaritas natural/accomplished (`>=16`), menjaga pemain bintang ber-CA tinggi tidak tergeser, dan menempatkan bek/gelandang tengah sesuai sisi kaki dominan (mis. kidal di `DCL`, kanan di `DCR`).
   - **Bench Cover 1-ke-1:** Pencocokan pemain cadangan memakai *unique assignment* (satu pemain serbabisa tidak lagi dihitung melapisi 4–5 posisi sekaligus).
   - **100% Data Live `.fm` (Opsi A — 0% Kebocoran Sample di UI):** Sebelum pengguna memuat file `.fm`, halaman Skuad, Staf Pelatih, dan Wonderkids menampilkan *empty state* bersih tanpa mencampur data dummy/seed statis. Pemain milik klub sendiri juga otomatis dikecualikan dari daftar target wonderkid eksternal.

4. **Satu Pintu Impor Pintar & Sinkronisasi Otomatis Antar-Halaman (`bba77af` — Tahap 3):**
   - Router file terpusat `importAnySupportedFile` (`apps/web/src/lib/file-importer.ts`) dan tombol global **`Muat .fm / .fmf`** di navbar atas (`TopNavShell.tsx`) dapat dipakai dari halaman mana saja untuk memuat save `.fm`, taktik `.fmf`/`.tac`, jadwal latihan `.fmf` (`.tsc`), maupun shortlist `.fmf` (`.slf`).
   - Sekali unggah `.fm` atau `.fmf`, state otomatis tersinkron ke Papan Taktik, Skuad, Jadwal Latihan 7×3, Staf Pelatih, dan target Wonderkids (mengincar posisi terlemah #1 skuad secara default).
   - Mengganti dropdown `Gaya` (*Style*) atau `Formasi` (*Shape*) saat save `.fm` aktif otomatis menyusun ulang 11 pemain klub terbaik tanpa mengosongkan nama pemain di lapangan.
   - Impor `.fmf` buatan sendiri diikuti impor `.fm` tidak saling menimpa paksa (pemain klub dipasang ke taktik `.fmf` aktif, disertai tombol untuk mencari taktik terbaik baru).

5. **Penyederhanaan UI/UX Khusus Pemain FM, Switch Bahasa `ID | EN`, Optimasi Peran & Legenda Warna (`75f3b1d`, `de14486`, `5581f41`):**
   - Tombol switch **`ID | EN`** di `TopNavShell.tsx` (`useLocaleStore.ts`, tersimpan di `localStorage`) mengubah seluruh teks antarmuka secara instan tanpa mencampur bahasa Indonesia–Inggris, sembari tetap mempertahankan istilah resmi in-game FM27 (`GK`, `DCL`, `Inside Forward`, `Gegenpress`, `Defend/Support/Attack`).
   - Seluruh opsi `.fm27.json`, `.json`, dan `CSV / HTML` telah dihapus dari UI (fokus murni `.fm` dan `.fmf`).
   - Seluruh label teknis/programmer (`Mode A/B/C`, `100% Data Deterministik (Non-AI)`, `Diproses 100% lokal di browser...`, `Zstd`, `Web Worker`, `Hungarian Solver`, rumus `ValueRatio`, `DDM`, `RankingFit`, `Eligibility Matrix Key`, `gemini-decision-1`) serta teks penjelasan/tutorial panjang telah dibersihkan dari layar.
   - Tombol **`Optimalkan Peran`** (`Optimize Roles`) di halaman `/squad` (`de14486`) telah diperbaiki penuh: membandingkan skor kecocokan taktik saat ini vs proyeksi optimal (`baseline` vs `improved`), menyelaraskan kandidat peran `RoleFitTable` dengan `gradeImportedTactic` (maks 1 OOP Outlet, tanpa peran *gimmick*), mempertahankan 11 starter yang sudah dipasang / dikunci (`lineupPreferences`), memperbarui *Duty* + *Player Instructions* per peran baru, menampilkan notifikasi ringkasan perubahan, dan berubah menjadi badge **`Peran Sudah Optimal ✓`** bila seluruh peran sudah maksimal.
   - Baris keterangan warna ringkas **`PitchColorLegend`** (`5581f41` di `Heatmap18Zone.tsx` & `page.tsx`) tampil tepat di bawah papan lapangan (`ID | EN`), menjelaskan arti warna lingkaran pemain (Biru IP / Oranye OOP / Hijau Kiper) serta warna kotak kepadatan area (`≥70%`, `40–69%`, `<40%`, dan kotak garis putus depan penalti) secara dinamis sesuai mode `Area` yang dipilih.

---

## 2. Keputusan Teknis & Arsitektur Penting (Termasuk yang Sengaja Dihindari)

1. **Wajib 0% Halusinasi / 0% LLM untuk Rekomendasi Taktik & Skuad:**
   - **Disepakati:** Semua analisis formasi, kecocokan pemain, jadwal latihan, bintang staf, dan target wonderkids **wajib 100% deterministik** dari `@fm27/fm-engine` + `@fm27/fm-data` atau data biner asli `.fm`/`.fmf`.
   - **Dihindari:** Dilarang memanggil API LLM/AI untuk menghasilkan rekomendasi taktik, mengarang nama pemain/staf, atau menampilkan kembali tombol `AI Tactical Advisor` di workspace utama.

2. **Batas Ketat Pemrosesan File `.fm` (Client-Side Worker Saja):**
   - **Disepakati:** File `.fm` (50–400 MB) wajib diproses 100% di browser lewat standalone Web Worker (`/workers/fm-save-worker.js`) dengan *Transferable ArrayBuffer*.
   - **Dihindari:**
     - **Dilarang** mengunggah file `.fm` ke API route/server (melewati batas payload Vercel 4,5 MB).
     - **Dilarang** melakukan fallback dekompresi `.fm` ke *main-thread* di browser (langsung membekukan tab UI).
     - **Dilarang** menggunakan `new Worker(new URL(..., import.meta.url), { type: "module" })` untuk parser `.fm` karena memicu deadlock *shared chunk* Webpack di Next.js 15.
     - **Dilarang** meng-commit file `*.fm` atau folder hasil reverse-engineering sementara (`/tmp`, `.tmp-fmsave-ref`, `_reference`, `.cs`) ke Git/Vercel (sudah dijaga di `.gitignore`, `.vercelignore`, dan `tests/production-phase6.spec.ts`).

3. **Prinsip Bahasa & Copywriting UI untuk Pemain Football Manager:**
   - **Disepakati:** Target audiens adalah pemain Football Manager, bukan programmer. Gunakan bahasa sepak bola yang ringkas dan familier; simpan penjelasan tutorial untuk fitur *First-Launch Onboarding* terpisah nanti.
   - **Dihindari:** Jangan menampilkan format perantara developer (`.fm27.json`, `CSV`, `HTML`), istilah algoritma internal (`Mode A/B/C`, `Hungarian`, `Kuhn-Munkres`, `DDM`, `Zone 14`, `0% AI`), klaim teknis (`Diproses 100% lokal...`), maupun rumus matematika di layar.

4. **Inspeksi File Biner & Disiplin Verifikasi:**
   - **Dihindari:** Jangan pernah membuka file `.fm` atau `.fmf` dengan tool pembaca teks biasa (akan merusak konteks/token). Gunakan skrip Node.js atau Vitest untuk inspeksi biner. Jangan instal library baru atau menjalankan Playwright kecuali diminta secara eksplisit oleh pengguna.

---

## 3. Bug, Error, atau Bagian Kode yang Masih Setengah Jalan

1. **Sesi `.fm` Hanya Hidup di RAM Tab Browser (Hilang Saat Refresh Halaman):**
   - Objek `liveFmSave` disimpan di memori runtime `useTacticStore` (tidak disimpan ke `localStorage` karena ukuran data melampaui kuota ~5 MB). Jika pengguna me-refresh halaman (`F5`), taktik di papan tetap bisa dipulihkan, namun data klub/pemain/wonderkids dari `.fm` harus dimuat ulang. *(Opsional ke depan: simpan ringkasan klub terpilih + pool ke `IndexedDB` agar tahan refresh).*

3. **Struktur Navigasi Atas vs Kotak Ringkasan 5-Tab Masih Bisa Dipadatkan Lagi:**
   - Saat ini antarmuka sudah bersih secara teks dan tombol, tetapi secara tata letak masih memiliki 6 rute halaman di navbar atas (`Papan Taktik`, `Skuad`, `Wonderkids`, `Staf Pelatih`, `Latihan`, `Komunitas`) sekaligus panel `UnifiedReportDashboard.tsx` (5 tab ringkasan) di halaman utama `/`. Jika ingin alur *1-2-3* yang benar-benar tunggal, penyatuan atau perampingan tata letak antar-halaman masih bisa dilanjutkan.

4. **Fitur *First-Launch Onboarding* Sengaja Belum Dibuat:**
   - Seluruh teks cara pakai (geser token di 24 titik posisi, klik dua kali untuk ubah peran/instruksi individu, drag-and-drop sesi latihan) telah dihapus dari tampilan utama sesuai instruksi Tahap 5 poin 4, dan menunggu dibuatkan panduan singkat *first-launch* (muncul sekali saja untuk pengguna baru).

5. **Modul Lama yang Sudah Dilepas dari UI Tetapi Masih Ada di Kode/Test Internal:**
   - `apps/web/src/components/analytics/AiAdvisorDrawer.tsx`, `/api/ai/tactical-review`, dan `@fm27/ai-analyst` sudah tidak dirender di halaman utama, namun masih diuji oleh `tests/ai-phase3.spec.ts` dan `tests/production-phase6.spec.ts`.
   - Fungsi parser/exporter `.fm27.json` dan `CSV/HTML` di `@fm27/fm-codec` & `@fm27/fm-engine` sudah dihapus dari UI, namun masih dipakai oleh unit test `tests/codec.spec.ts`, `tests/engine.spec.ts`, dan `tests/unified-analyzer.spec.ts`. Hati-hati jika ingin membersihkan kode mati agar test suite tidak patah.

6. **Halaman Komunitas (`/community`) Membutuhkan Env Supabase untuk Penyimpanan Permanen:**
   - Jika `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY` belum diisi di Vercel/cloud, endpoint `/api/community/*` otomatis memakai fallback *in-memory* yang ter-reset saat instance serverless berganti.

---

## 4. Urutan Langkah Kerja Berikutnya & Checklist Uji Save Volunteer Komunitas

1. **Langkah 1 — Evaluasi Hasil Uji File Save `.fm` dari Volunteer Komunitas:**
   - Saat menguji berbagai file save `.fm` dari komunitas, perhatikan skenario *edge-case* berikut:
     - **Save Manajer Menganggur (*Unemployed*) / Tim Nasional:** Pastikan modal pemilih klub (`ClubPickerModal`) langsung terbuka otomatis ketika `humanClubUid` tidak merujuk ke klub berpemain `>= 11`.
     - **Klub Kasta Bawah / Semi-Pro dengan Skuad Tipis:** Jika `First Team` memiliki `< 11` pemain atau tanpa kiper senior (`GK >= 15`), pastikan fallback otomatis ke gabungan `First Team + U21 / U18` di `selectPrimarySquadPlayers` berjalan mulus tanpa error.
     - **Save Karier Tahun Jauh (2032+) dengan Regen / Newgen & Database Custom:** Cek apakah ekstraksi blok pemain/staf pada `packages/fm-codec/src/fm-save-parser.ts` tetap akurat untuk pemain regen serta ukuran file besar (`150–400 MB`).
     - **Variasi Gaya Klub Kecil vs Klub Elite:** Pastikan klub papan bawah (`avgTop11Ability < 11.5`) mendapat rekomendasi formasi realistis/pragmatis dan tidak dipaksa bermain *Tiki-Taka* garis tinggi.

2. **Langkah 2 — Bangun *First-Launch Onboarding* Ringkas (`ID | EN`):**
   - Buat komponen modal/panduan singkat 3 langkah yang hanya tampil saat kunjungan pertama (`localStorage` key mis. `fm27-onboarding-seen-v1`, dilengkapi tombol `?` kecil di `TopNavShell` jika ingin dibuka kembali):
     1. *Muat Save Karier (`.fm`) atau Taktik (`.fmf`)*
     2. *Atur Formasi Menyerang (IP) & Bertahan (OOP) serta Cek Skuad/Latihan*
     3. *Unduh File `.fmf` Siap Pakai ke Folder Football Manager 27*

3. **Langkah 3 — Persistensi Sesi `.fm` di `IndexedDB` (Opsional / High-UX Impact):**
   - Simpan hasil ekstraksi ringkas `ParsedFmSave` (atau klub aktif + `worldWonderkids` + `worldStaffPool`) ke `IndexedDB` browser agar pengguna tidak perlu memilih ulang file `.fm` 70–200 MB setiap kali me-refresh tab browser, lengkap dengan tombol *Hapus/Ganti Save*.

4. **Langkah 4 — Baseline Verifikasi Cepat Setiap Sesi Baru:**
   ```bash
   pnpm data:validate && pnpm typecheck && pnpm test && pnpm --filter @fm27/web build
   ```
   *(Catatan: `tests/unified-analyzer.spec.ts` dan `tests/fm-save-parser.spec.ts` sudah memakai `it.skipIf(!fs.existsSync(sampleFmPath))` sehingga aman dijalankan di GitHub Actions/Cloud tanpa fixture biner 70 MB).*

---

## 5. Daftar File Utama yang Harus Dicek Lebih Dulu

### Aturan & Konfigurasi Proyek
1. `AGENTS.md` — Aturan wajib proyek (0% halusinasi, aturan codec biner `.fmf`/`.fm`, hemat token, dan perintah verifikasi).
2. `package.json` — Daftar skrip workspace (`worker:build`, `data:validate`, `typecheck`, `test`, `build`).

### State Global, Lokalisasi & Impor File (`apps/web`)
3. `apps/web/src/stores/useTacticStore.ts` — Pusat state taktik aktif, sesi live `.fm` (`liveFmSave`, `clubPlayers`, `clubStaff`, `worldWonderkids`, `worldStaffPool`), dan sinkronisasi lintas-store (`useSquadStore` & `useTrainingStore`).
4. `apps/web/src/stores/useLocaleStore.ts` — Store dwi-bahasa `ID | EN`, helper `useLocale()` / `tr()`, pemformatan progres `.fm`, dan pelokalan catatan taktis.
5. `apps/web/src/lib/file-importer.ts` — Pintu masuk tunggal (`importAnySupportedFile`) untuk file `.fm` dan `.fmf` (taktik `.tac`, jadwal `.tsc`, shortlist `.slf`).
6. `apps/web/src/lib/worker-client.ts` & `scripts/build-save-worker.mjs` — Orkestrasi standalone Web Worker `/workers/fm-save-worker.js` (`PING/PONG`, Blob fallback, Transferable `ArrayBuffer`, watchdog).

### Komponen UI Utama (`apps/web`)
7. `apps/web/src/components/TopNavShell.tsx` & `apps/web/src/components/ClubPickerModal.tsx` — Navbar global, tombol `Muat .fm / .fmf`, pemilih klub karier `.fm`, banner progres loading, dan switch `ID | EN`.
8. `apps/web/src/app/page.tsx` & `apps/web/src/components/analytics/UnifiedReportDashboard.tsx` — Workspace utama Papan Taktik Dual-Phase (IP/OOP) dan panel ringkasan 5-tab.
9. `apps/web/src/app/squad/page.tsx`, `apps/web/src/app/wonderkids/page.tsx`, `apps/web/src/app/staff/page.tsx`, `apps/web/src/app/training/page.tsx` — Empat halaman fitur utama yang terhubung otomatis ke `useTacticStore`.

### Mesin Analitik & Codec Biner (`packages/*`)
10. `packages/fm-engine/src/unified-analyzer.ts` & `packages/fm-engine/src/squad-analyzer.ts` — Orkestrator 5 rekomendasi deterministik, isolasi `First Team`, dan solver `13 Gaya × 16 StyleShapes`.
11. `packages/fm-engine/src/role-evaluator.ts`, `packages/fm-engine/src/hungarian.ts`, `packages/fm-engine/src/local-refiner.ts` — Kurasi kandidat peran IP/OOP, matriks Hungarian dengan preferensi kaki/CA, dan *local refinement*.
12. `packages/fm-codec/src/fm-save-parser.ts`, `packages/fm-codec/src/fmf-archive.ts`, `packages/fm-codec/src/tac-serializer.ts` — Parser biner save `.fm` Zstd serta pembungkus/penulis biner `.fmf` / `.tac`.
13. `tests/unified-analyzer.spec.ts`, `tests/fm-save-parser.spec.ts`, `tests/codec.spec.ts`, `tests/production-phase6.spec.ts` — Suite pengujian regresi utama yang wajib dijaga tetap hijau.
