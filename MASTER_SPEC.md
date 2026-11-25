# MASTER PROMPT & BLUEPRINT ARSITEKTUR: FM27 TACTICS GENERATOR (WEB-NATIVE REBUILD)

Gunakan seluruh dokumen ini sebagai **Single Source of Truth (`MASTER_SPEC.md`)** untuk membangun ulang **FM27 Tactics Generator** dari nol (**0 to Production**) di **Antigravity Web / Remote**. Dokumen ini mengintegrasikan arsitektur monorepo modern, sumber data **Google Drive (output REA)** secara *read-only*, **3 repositori GitHub referensi FM27**, **2 skill penghemat token (`caveman` & `ponytail`)**, codec biner `.fmf` murni TypeScript, mesin taktik deterministik, asisten AI Gemini API terbaru, 9 fitur improvisasi web, skema Supabase, serta workflow CI/CD dan *zero-code maintenance*.

---

## 1. Peran, Misi & Hierarki Aturan (Precedence Matrix)

Bertindaklah sebagai **Principal Full-Stack Architect, Reverse-Engineering Data Systems Engineer, dan UI/UX Specialist**. Bangun proyek **`fm27-tactics-generator`** secara *end-to-end* dengan menggantikan arsitektur desktop lama (.NET Framework 4.0 WinForms + *sidecar* Embedded Python 3 `FM27ClubRuntime`) menjadi platform web modern berbasis **Next.js + TypeScript + Web Workers + Supabase + Gemini API**.

### Hierarki Aturan (Wajib Ditaati agar Skill Penghemat Token Tidak Mengurangi Kualitas)
1. **Prioritas #1 — `MASTER_SPEC.md` (Scope & Presisi):** Mengatur arsitektur monorepo, 9 fitur wajib, seluruh rumus matematis `fm-engine`, dan seluruh spesifikasi byte-level `fm-codec`. **Tidak boleh ada fitur, rumus, atau validasi yang dipotong.**
2. **Prioritas #2 — `Ponytail` (Disiplin Implementasi Kode):** Mengatur *cara* menulis kode di dalam setiap modul—tulis kode seminimal mungkin yang menyelesaikan masalah secara utuh, utamakan primitif browser/platform (`DataView`, Web Crypto, SVG, native HTML inputs), larang abstraksi berlebih/dependensi duplikat, dan **wajib sertakan unit test untuk setiap logika berisiko** (`.fmf` binary codec, Hungarian Solver, perhitungan skor, autentikasi/RLS).
3. **Prioritas #3 — `Caveman` (Efisiensi Komunikasi & Output Tool):** Mengatur *cara* agent merespons dan membaca output terminal—jawaban padat tanpa basa-basi, ringkas log test/build agar hemat token, **tetapi wajib gunakan kalimat penuh dan jelas untuk peringatan keamanan, aksi destruktif/irreversible, dan error kritis.**

### Prinsip Teknis Non-Negotiable
1. **Zero Shortcut pada Mesin & Biner:** Pertahankan 100% presisi matematis dari mesin taktik deterministik asli (*Hungarian Algorithm*, *Fit Score*, *Coaching Review*, *Instruction Penalty*, *RankingFit*) serta format biner `.fmf`/`.tac`/Zstd Raw Frame.
2. **Data Terpisah dari Kode (*Patch-Ready Architecture*):** Dilarang melakukan *hardcode* daftar role, atribut, bitmask instruksi, gaya main, sesi latihan, atau rumus staf di dalam komponen React maupun fungsi inti. Seluruh data game wajib berada di `packages/fm-data/versions/<patch>/` dan divalidasi dengan Zod.
3. **Client-First & Graceful Degradation:** Mesin taktik (`fm-engine`), codec `.fmf` (`fm-codec`), dan Heatmap 18 zona berjalan 100% lokal di browser (Web Worker + PWA offline). Fitur AI dan Galeri Komunitas bertindak sebagai pengaya yang tidak memblokir fungsi inti jika offline atau kuota API habis.
4. **Standar Gemini API Terbaru:** Wajib menggunakan SDK `@google/genai` versi `>= 3.2.0` dengan **Interactions API (`v1`)** dan **Decisions API (`v1beta`)**. Dilarang keras memakai `@google/generative-ai`, method `generateContent`, atau model lama (`gemini-2.5-*`, `gemini-2.0-*`, `gemini-1.5-*`).
5. **Strict TypeScript & Automated Verification:** Aktifkan `"strict": true` di seluruh workspace. Setiap fase wajib lolos `pnpm typecheck`, `pnpm lint`, dan `pnpm test` sebelum berpindah ke fase berikutnya.

---

## 2. Workflow Antigravity Web / Remote, Token Saving & Integrasi Eksternal

### A. Integrasi 2 Skill Penghemat Token (`Caveman` + `Ponytail`) — Aman untuk Web / Remote
Karena proyek berjalan di **Antigravity Web / Remote** (lingkungan sandbox/cloud), **JANGAN** menjalankan local HTTP proxy daemon atau memodifikasi konfigurasi OS global yang rentan konflik jaringan. Terapkan integrasi **Project-Scoped Skills & `AGENTS.md`** di Fase 0:

1. **Caveman (`https://github.com/JuliusBrussee/caveman`) — Mode *Skill-Only*:**
   - Pasang hanya folder skill ke proyek lokal (`.agents/skills/caveman/`) via `npx skills add JuliusBrussee/caveman -a antigravity` (atau salin `skills/caveman/SKILL.md` bila sandbox membatasi CLI interaktif) dan rangkum aturannya di `AGENTS.md`.
   - **Batasan Keamanan Wajib:**
     - **DILARANG** menjalankan `/caveman-compress` pada `MASTER_SPEC.md`, file JSON katalog, skema Zod, file SQL, atau dokumentasi spesifikasi biner (kompresi teks pada spesifikasi teknis dapat merusak *magic bytes*, bitmask, dan rumus).
     - Gunakan gaya ringkas hanya untuk *progress update*, laporan antar-fase, dan penyaringan output shell (`pnpm test --reporter=dot` / tail error saja).
2. **Ponytail (`https://github.com/DietrichGebert/ponytail`) — Mode *Lazy Senior Dev*:**
   - Pasang skill proyek ke `.agents/skills/ponytail/` (dari `skills/ponytail/SKILL.md`) dan gabungkan prinsip intinya ke `AGENTS.md`.
   - Terapkan mode `full` secara default selama coding: hindari boilerplate berlebih, dilarang memasang library UI/utilitas baru jika primitif web/Next.js/Tailwind sudah mencukupi, tandai kompromi sementara dengan komentar `// shortcut: <alasan & kapan diperbaiki>`, dan jalankan checklist **`ponytail-review`** (cek bug, keamanan, beban nyata, cakupan test pada logika berisiko) di setiap *Verification Gate* akhir fase.

### B. Integrasi Aman Google Drive (Output REA Legacy)
User telah menautkan folder **Google Drive** yang berisi hasil *Reverse Engineering Analysis (REA)* aplikasi lama (`fm-tactic-generator/`). Terapkan protokol ketat berikut agar hemat token dan aman secara hukum/Git:

1. **STRICTLY READ-ONLY:** Jangan pernah membuat, mengubah, memindahkan, atau menghapus file apa pun di dalam Google Drive user.
2. **HARD-IGNORE (Dilarang Dibaca Otomatis):**
   - **ABAIKAN TOTAL** folder `extracted-runtime/` (berisi binary Python lama ~12 MB yang tidak relevan untuk web TypeScript).
   - **ABAIKAN** folder `07-rea-evidence/` (berisi dump IL mentah berukuran besar yang sangat boros token). Hanya boleh membaca 1 file spesifik di `07-rea-evidence/` jika dan hanya jika terjadi kegagalan *byte-level* pada unit test `.fmf` di Fase 1.
   - **ABAIKAN** `01-arsitektur-dan-runtime.md` & `README.md` kecuali untuk pengecekan cepat 1 kali jika dibutuhkan.
3. **Phase-Scoped Lazy Reading (Baca Sesuai Fase Saja):**
   - **Fase 0 (`fm-data`):** Baca **hanya** `05-data-schemas/` untuk mengisi seluruh JSON di `packages/fm-data/versions/v27.0/` secara presisi (koordinat 24 posisi, 80 role + 64-bit `Flags`, 29 TI, 17 PI, `Conflicts`, 23 sumber + 10 aturan + 3 penyesuaian kepelatihan, dan katalog sesi latihan).
   - **Fase 1 (`fm-codec` & `fm-engine`):** Baca **hanya** `03-format-biner-fmf-dan-save-reader.md`, `02-algoritma-inti-pembuatan-taktik.md`, dan file spesifik yang diperlukan di `06-reconstructed-code/` (untuk konstanta `DefaultPreferences`, `TacticalStyle`, `PlayerInstructions`, dan `ScoreInstructionDemands`).
   - **Fase 4 (Modul Pendukung):** Baca **hanya** `04-modul-pendukung-dan-fitur-sekunder.md` untuk referensi fitur *grading*, *comparison*, dan rekomendasi *upgrade* skuad.
4. **Anti-Leak Git Hygiene:** Jangan pernah menyalin kode C# rekonstruksi atau file REA mentah ke dalam repositori Git. Pastikan `_reference/` selalu terdaftar di `.gitignore`. Hanya file JSON bersih tervalidasi Zod (`packages/fm-data/versions/v27.0/*.json`) dan kode TypeScript baru yang boleh masuk ke Git.

### C. 3 Repositori GitHub Referensi FM27 (Khusus Fase 4 — Ephemeral `/tmp`)
Jangan membaca atau meng-clone repositori eksternal ini sebelum masuk **Fase 4**. Saat Fase 4 dimulai, lakukan *shallow clone* (`git clone --depth 1`) sementara ke `/tmp/fm-refs/`, ekstrak hanya struktur header kolom / bobot rumus / template jadwal yang dibutuhkan, lalu **hapus `/tmp/fm-refs/` sebelum commit**:

1. **`https://github.com/ElectroHugin/FM-View-Exporter`**
   - *Tujuan:* Mempelajari format kolom CSV dan HTML keluaran tombol `F9` untuk FM27 (sangat penting karena FM26/FM27 menghapus fitur ekspor bawaan `Ctrl+P`). Terapkan dukungan parsernya di `csv-squad-parser.ts` dan `html-fm-parser.ts` berdampingan dengan format `fmsave`.
2. **`https://github.com/HansMellman/FM_Staff_Scores`**
   - *Tujuan:* Acuan bobot atribut primer, sekunder, dan *DDM* (`Determination + Discipline + Motivating`) untuk mengisi `packages/fm-data/versions/v27.0/staff-formulas.json` dan `staff-calculator.ts`.
3. **`https://github.com/jamiebolden/fm-scoring`**
   - *Tujuan:* Acuan preset jadwal latihan mingguan FM27 (Pre-Season, 1-Match Week, Congested 2-Match Week, Wonderkid Focus) serta referensi filter pencarian staf/pemain untuk `/training` dan `/staff`.

---

## 3. Peta Direktori & Inventaris File Lengkap

Buat struktur monorepo menggunakan **pnpm workspaces + Turborepo** dengan rincian file berikut:

```text
fm27-tactics-generator/
├── AGENTS.md                                   # Aturan terpadu Antigravity: Precedence + Ponytail + Caveman + GDrive Guard
├── MASTER_SPEC.md                              # Dokumen spesifikasi utama ini
├── .gitignore                                  # WAJIB mencakup: _reference/, .env*, /tmp/, .turbo/
├── .agents/
│   └── skills/
│       ├── caveman/                            # Skill-only dari JuliusBrussee/caveman (tanpa proxy daemon)
│       └── ponytail/                           # Skill-only dari DietrichGebert/ponytail (lazy senior dev + review)
├── .github/
│   └── workflows/
│       ├── ci.yml                              # Lint, Typecheck, Vitest (codec + engine), Next.js Build
│       ├── data-validation.yml                 # Validasi otomatis PR update JSON di packages/fm-data
│       └── sync-trending.yml                   # Cron backup refresh materialized view trending wonderkids
├── docs/
│   ├── ARCHITECTURE.md                         # Diagram alur data & keputusan arsitektur (ADR)
│   ├── MAINTENANCE_WORKFLOW.md                 # SOP update patch FM27.x, rollback, & penambahan role/staf
│   └── BINARY_FMF_SPEC.md                      # Dokumentasi byte-level .fmf / .tac / details.aom / Zstd
├── scripts/
│   ├── extract-legacy-data.mjs                 # Ekstraktor otomatis dari GDrive REA / instalasi lama -> JSON v27.0
│   ├── validate-data.mjs                       # Validator integritas silang (bitmask, mask, role flags, conflicts)
│   ├── new-patch-version.mjs                   # CLI scaffold folder patch baru (misal: v27.0 -> v27.3)
│   ├── generate-golden-fixtures.mjs            # Pembuat fixture uji round-trip .fmf & squad.csv
│   └── seed-db.mjs                             # Skrip upsert wonderkids-seed.json & staff-seed.json ke Supabase
├── packages/
│   ├── shared-types/
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── catalog.schema.ts               # Zod: Position, Role, TI, PI, Conflict, TacticalStyle
│   │       ├── tactic.schema.ts                # Zod: DualPhaseTactic, SlotAssignment, .fm27.json v1
│   │       ├── squad.schema.ts                 # Zod: Player (49 attrs), LineupPreference, AuditResult
│   │       ├── staff.schema.ts                 # Zod: StaffMember, StarRatingBreakdown, AssignmentPlan
│   │       ├── training.schema.ts              # Zod: TrainingSession, WeeklySchedule, LoadMetrics
│   │       ├── wonderkid.schema.ts             # Zod: Wonderkid, RoleFitRanking, TrendingItem
│   │       └── community.schema.ts             # Zod: Submission, ModerationDecision, FilterParams
│   ├── fm-data/
│   │   ├── package.json
│   │   ├── versions/
│   │   │   └── v27.0/
│   │   │       ├── manifest.json               # Metadata versi patch, checksum SHA-256, tanggal rilis
│   │   │       ├── pitch-catalog.json          # 24 posisi, 80 role IP/OOP + 64-bit Flags, Eligibility, 29 TI, 17 PI, Conflicts
│   │   │       ├── coaching-knowledge.json     # 23 Sources (UEFA/FIFA/FA/SI), 10 Rules, 3 Auto-Adjustments
│   │   │       ├── role-profiles.json          # ~32 profil Role (5 atribut kunci), 49 AllAttributes, Goalkeeping, LowerIsBetter
│   │   │       ├── tactical-styles.json        # 13 TacticalStyles, 7 Mentalities, 8 Shapes default, 16 StyleShapes
│   │   │       ├── training-sessions.json      # Katalog sesi latihan (code, max/week, impact, unit attributes)
│   │   │       ├── training-presets.json       # Preset jadwal mingguan FM27 (Pre-Season, 1-Match, 2-Match, Wonderkid)
│   │   │       ├── staff-formulas.json         # Bobot DDM + atribut primer/sekunder untuk 10 kategori bintang latihan
│   │   │       ├── staff-seed.json             # Kurasi staf terbaik & free agents awal
│   │   │       └── wonderkids-seed.json        # Kurasi awal wonderkids U-21 (atribut, rentang PA, harga estimasi)
│   │   └── src/
│   │       ├── index.ts                        # Registry loader dinamis berdasarkan patchVersion
│   │       └── patch-registry.ts               # Resolver versi aktif + migrator antar-versi skema
│   ├── fm-codec/
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── binary-writer.ts                # Little-Endian DataView/Uint8Array writer + BigInt 64-bit helper
│   │       ├── binary-reader.ts                # Little-Endian reader dengan bounds check ketat
│   │       ├── zstd-raw-frame.ts               # Pure TS Zstandard Raw Block Framer (28 B5 2F FD A0, Block_Type=0, 64KB chunks)
│   │       ├── aes-ctr-decrypt.ts              # Web Crypto AES-128-CTR handler untuk header afe. terenkripsi
│   │       ├── tac-serializer.ts               # Encoder/Decoder payload .tac (PlanHeader, Mentality, 96-bit TI, 11x2 Slots, LLUN)
│   │       ├── details-aom.ts                  # Encoder/Decoder _data/details.aom (moa. header, handler, 10-byte GUID)
│   │       ├── fmf-archive.ts                  # Packer/Unpacker kontainer .fmf + TOC + fzstd decompression
│   │       ├── json-format.ts                  # Import/Export .fm27.json (Zod validated)
│   │       ├── url-share.ts                    # Minify tactic state + lz-string URL encoder/decoder (#t=...)
│   │       └── schedule-codec.ts               # Import/Export jadwal latihan (.fm27-schedule.json & adaptor kontainer .fmf)
│   ├── fm-engine/
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── normalizer.ts                   # Validasi minimal 11 pemain (GK>=15) & normalisasi raw 0-125 -> 1-20
│   │       ├── role-evaluator.ts               # BestRole (5 keys, inverted foot bonus, -0.45 specialist, +0.20 style synergy)
│   │       ├── fit-calculator.ts               # posScore (65/35), standard/fullProfile weights, OOP penalty, GK/outfield -1000
│   │       ├── hungarian.ts                    # Algoritma Hungarian (Kuhn-Munkres) O(n^2 * m) + +10000 lineup locks
│   │       ├── local-refiner.ts                # Refine(): swap starter<->reserve & role swap terhadap CoachingKnowledge
│   │       ├── instruction-planner.ts          # Baseline adaptif, TacticalStyle overlay, Priorities, Conflict resolver, PI recommender
│   │       ├── coaching-review.ts              # Review() (tanh formula), auto-adjustment (Below threshold), ScoreInstructionDemands
│   │       ├── squad-analyzer.ts               # Orkestrator penuh -> TacticPlan, SquadFit, RankingFit, Near-Tie detection
│   │       ├── formation-detector.ts           # Auto-deteksi string formasi IP & OOP dari 11 koordinat slot aktif
│   │       ├── heatmap-18zone.ts               # Kalkulator densitas 18 zona lapangan (IP, OOP, Transisi, Zone 14, Half-Spaces)
│   │       ├── balance-scorer.ts               # Skor Keseimbangan 0-100 (6 pilar) & detector celah struktural
│   │       ├── squad-audit.ts                  # Role Fit Score per starter, 3 posisi terlemah, saran pengganti internal/wonderkids
│   │       ├── wonderkid-ranker.ts             # Ranking Role Fit terhadap slot terlemah + Value Ratio Score
│   │       ├── staff-calculator.ts             # Kalkulator bintang 0.5-5.0 + Staff Assignment & Workload Optimizer
│   │       ├── training-recommender.ts         # Rekomendasi sesi berdasarkan kelemahan atribut skuad / wonderkids + validasi beban
│   │       └── parsers/
│   │           ├── csv-squad-parser.ts         # Parser CSV fmsave (uid, name, club_uid...) & FM-View-Exporter (F9)
│   │           ├── html-fm-parser.ts           # Parser HTML FM-View-Exporter (F9) & legacy HTML export untuk skuad & staf
│   │           └── fm-save-adapter.ts          # Interface modular untuk konektor WASM/Pyodide atau CLI lokal file .fm
│   └── ai-analyst/
│       ├── package.json
│       └── src/
│           ├── index.ts
│           ├── client.ts                       # Singleton GoogleGenAI (v1 & v1beta), env validation, rate-limit guard
│           ├── tactical-advisor.ts             # Interactions API streaming (gemini-4-hydrogen / gemini-4-neon / gemini-3.5-flash-lite)
│           ├── community-moderator.ts          # Decisions API v1beta (gemini-decision-1: noul safety + choice playstyle + score quality)
│           └── semantic-search.ts              # gemini-embedding-2 untuk pencarian natural language galeri
├── apps/
│   └── web/
│       ├── next.config.ts                      # PWA headers, transpilePackages monorepo
│       ├── public/
│       │   └── manifest.json                   # Web App Manifest (installable PWA)
│       └── src/
│           ├── app/
│           │   ├── layout.tsx                  # Dark Tactical Theme, Navigation Shell, Patch Selector, Local Sync Indicator
│           │   ├── page.tsx                    # Workspace Utama: Papan Taktik Dual-Phase (IP/OOP/Split) + Analisis + AI Drawer
│           │   ├── squad/page.tsx              # Audit Skuad, Impor CSV/HTML/Folder, Role Fit & Pengganti Instan
│           │   ├── wonderkids/page.tsx         # Rekomendasi Wonderkids (Best Fit untuk Taktik Aktif + Trending Mingguan)
│           │   ├── staff/page.tsx              # Kalkulator Bintang Staff, Free Agents & Assignment Optimizer
│           │   ├── training/page.tsx           # Saran Latihan Adaptif + Interactive Weekly Schedule Builder + Export/Import
│           │   ├── community/
│           │   │   ├── page.tsx                # Galeri Komunitas (Taktik, Jadwal, Shortlist) + Auto SVG Preview + Filter
│           │   │   └── [id]/page.tsx           # Detail Postingan + Interactive Preview + Load to Board + Download .fmf
│           │   └── api/
│           │       ├── ai/tactical-review/route.ts   # SSE Streaming endpoint -> Interactions API
│           │       ├── community/submit/route.ts     # Parse .fmf + moderasi gemini-decision-1 + simpan Supabase
│           │       ├── community/trending/route.ts   # Query materialized view trending mingguan
│           │       └── analytics/event/route.ts      # Pencatat event ringan (view/bookmark/shortlist/upvote)
│           ├── workers/
│           │   └── engine.worker.ts            # Web Worker: menjalankan fm-engine & fm-codec tanpa freeze UI
│           ├── stores/
│           │   ├── useTacticStore.ts           # Zustand + Undo/Redo (zundo) untuk state taktik IP/OOP, TI/PI, Mentality
│           │   ├── useSquadStore.ts            # State skuad terimpor, lineup locks, hasil audit
│           │   ├── useFolderSyncStore.ts       # State FileSystemDirectoryHandle + IndexedDB persistence
│           │   └── useTrainingStore.ts         # State jadwal mingguan 7x3 & kalkulasi fatigue/sharpness
│           ├── lib/
│           │   ├── local-folder-sync.ts        # Wrapper File System Access API + IndexedDB + Safari/Firefox fallback
│           │   ├── supabase-client.ts          # Browser & Server Supabase clients
│           │   └── svg-card-exporter.ts        # Render SVG taktik Dual-Phase -> PNG card untuk share
│           └── components/
│               ├── pitch/                      # DualPhasePitch.tsx, SplitViewPitch.tsx, TransitionVectors.tsx, PlayerToken.tsx
│               ├── instructions/               # MentalityBar.tsx, TeamInstructionPanel.tsx, PlayerInstructionModal.tsx
│               ├── analytics/                  # Heatmap18Zone.tsx, BalanceRadar.tsx, CoachingFindingsList.tsx, AiAdvisorDrawer.tsx
│               ├── squad/                      # SquadImporter.tsx, RoleFitTable.tsx, WeakestPositionsCard.tsx, ReplacementModal.tsx
│               ├── wonderkids/                 # WonderkidCard.tsx, TrendingStrip.tsx, ShortlistExporter.tsx
│               ├── staff/                      # StaffStarCalculator.tsx, StaffOptimizerTable.tsx
│               ├── training/                   # WeeklyScheduleGrid.tsx, SessionPalette.tsx, LoadMeterBar.tsx
│               └── community/                  # FmfDropzoneUploader.tsx, AutoTacticThumbnail.tsx, UpvoteBookmarkBar.tsx
├── supabase/
│   └── migrations/
│       ├── 0001_initial_schema.sql             # Tabel utama + indexes + triggers
│       ├── 0002_rls_policies.sql               # Row Level Security ketat
│       └── 0003_trending_and_vectors.sql       # Materialized view trending 7 hari + pgvector index
├── tests/
│   ├── fixtures/                               # Sample .fmf, squad.csv, staff.csv, expected outputs
│   ├── codec.spec.ts                           # Unit & round-trip test .fmf / .tac / Zstd / URL
│   └── engine.spec.ts                          # Unit & regression test Hungarian, Fit, CoachingReview, Staff, Heatmap
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

---

## 4. Skrip Migrasi Aset Legacy, Seeding & Validator Data (`scripts/`)

Bangun skrip Node.js ESM ringan (tanpa dependensi berlebih sesuai prinsip Ponytail) agar ekstraksi dari Google Drive REA dan pembaruan patch masa depan sepenuhnya terotomasi:

### A. `scripts/extract-legacy-data.mjs`
- **Input CLI:** `--rea-source "<path/to/gdrive/fm-tactic-generator>" --out "packages/fm-data/versions/v27.0"` (mendukung juga `--legacy-install` dan `--seed-defaults`).
- **Fungsi Utama:**
  1. Membaca `05-data-schemas/` dari folder Google Drive REA (mode *read-only*) untuk menormalisasi dan menghasilkan:
     - `pitch-catalog.json` (dari `FM27PitchCatalog`: 24 posisi, 80 role IP/OOP + 64-bit `Flags`, `Eligibility`, 29 grup TI, 17 grup PI, `Conflicts`).
     - `coaching-knowledge.json` (dari `FM27CoachingKnowledge`: 23 sumber, 10 rules, 3 auto-adjustments).
     - `training-sessions.json` (dari `FM27TrainingSessions`).
     - `role-profiles.json` & `tactical-styles.json` (dari definisi `SquadAnalysis`, `TacticalStyle`, dan `FormationLibrary`).
  2. Jika folder `current/resources/` lokal tersedia via `--legacy-install`, otomatis menyalin `resources/languages/*.json` ke `apps/web/src/messages/` dan mendeteksi header PNG (`89 50 4E 47`) pada `Instruction.player-*` / `Instruction.team-*` ke `apps/web/public/icons/instructions/*.png`.
  3. Menghasilkan `manifest.json` berisi versi (`27.0`), timestamp, ringkasan jumlah entitas, dan checksum SHA-256 setiap file JSON.
  4. **Fallback Mode (`--seed-defaults`):** Jika path GDrive sementara tidak terjangkau di CI/sandbox, hasilkan kerangka lengkap `v27.0/*.json` valid Zod sesuai Bagian 5.

### B. `scripts/validate-data.mjs` (Dijalankan di CI & Setiap Gate)
Memeriksa integritas lintas-file pada setiap versi di `packages/fm-data/versions/*`:
1. Validasi seluruh file JSON terhadap skema Zod di `packages/shared-types`.
2. Pastikan setiap `Role.Id` di `role-profiles.json` dan `tactical-styles.json` ada di `pitch-catalog.json` dengan 64-bit `Flags` valid (`BigInt`).
3. Pastikan setiap pasangan bit di `PitchCatalog.Conflicts` (misal `[25, 28]`, `[25, 29]`, `[26, 28]`) merujuk ke bit `Instructions` yang eksis.
4. Pastikan setiap `Adjustment.From` / `Adjustment.To` di `coaching-knowledge.json` (misal bit `65 -> 66` untuk `TriggerPress`) merujuk ke bit instruksi yang sah.
5. Verifikasi seluruh 16 pasangan `StyleShapes` dan 8 pasangan `Shapes` memakai ID posisi valid dari 24 slot `PitchCatalog.Positions`.

### C. `scripts/new-patch-version.mjs` & `scripts/seed-db.mjs`
- `pnpm data:new-patch 27.3 --from 27.0`: menyalin folder versi lama ke `versions/v27.3/`, memperbarui `manifest.json`, mendaftarkan di `patch-registry.ts`, dan menjalankan `validate-data.mjs`.
- `pnpm db:seed`: melakukan *idempotent upsert* `wonderkids-seed.json` dan `staff-seed.json` ke Supabase menggunakan `SUPABASE_SERVICE_ROLE_KEY`.

---

## 5. Spesifikasi Data Registry (`packages/fm-data/versions/v27.0/`)

1. **`pitch-catalog.json`**:
   - `Positions`: 24 slot lapangan lengkap dengan `Id` (`GK`, `DCR`, `DCL`, `DR`, `DL`, `DM`, `MC`, `AMR`, `AML`, `STC`, dst.), 32-bit `Mask` biner (contoh: `DCR` -> `Mask: 2097168`), dan koordinat `X`/`Y` (contoh: `X: 67, Y: 78`).
   - `Roles`: 80 role mencakup fase *In Possession* (contoh: `BallPlayingCentreBack`, `Flags: "16777216"`) dan *Out of Possession* (contoh: `OPPressingDefensiveMidfielder`, `Flags: "131072"`).
   - `Eligibility`: matriks kelayakan role terhadap posisi lapangan.
   - `Instructions`: 29 grup *Team Instructions* (`Group`, `Label`, `Out` boolean, `Current`, `Options[{ Bit, Label }]`, contoh `Tempo`: `49="Much lower"`, `0="Standard"`, `47="Higher"`).
   - `Conflicts`: array pasangan bit yang saling bertentangan (contoh `[[25, 28], [25, 29], [26, 28]]`).
   - `PlayerInstructions` & `PlayerInstructionPolicies`: 17 grup instruksi pemain beserta aturan kebijakan per role.
2. **`coaching-knowledge.json`**:
   - `Sources`: 23 referensi kepelatihan dunia nyata (UEFA, FIFA Technical Study Group, The FA, Sports Interactive).
   - `Rules`: 10 aturan evaluasi struktural (`Id`, `Title`, `When`, `Metric`, `Target`, `Weight`, `Sources`; contoh: `press`, `When: "high"`, `Target: 13`, `Weight: 1.30`, `Sources: ["uefa-klopp", "uefa-sacchi", "uefa-arteta"]`).
   - `Adjustments`: 3+ aturan auto-koreksi instruksi (`Metric`, `Style`, `Group`, `From`, `To`, `Below`, `Prefix`, `Text`; contoh: `Gegenpress` saat `press < 12.5` menurunkan `TriggerPress` dari bit `65` ke `66`).
3. **`role-profiles.json`**:
   - ~32 profil `Role` dengan tepat 5 atribut kunci per role (contoh: `InsideForward` -> `["dribbling", "off_the_ball", "acceleration", "finishing", "composure"]`; `DeepPlaymaker` -> `["passing", "vision", "decisions", "first_touch", "composure"]`).
   - 49 `AllAttributes`, daftar atribut `Goalkeeping`, dan daftar `LowerIsBetter` (`["dirtiness", "injury_proneness", "eccentricity", "controversy"]`).
4. **`tactical-styles.json`**:
   - 7 `Mentalities` (`1 = Very Defensive` s.d. `7 = Very Attacking`).
   - 13 preset `TacticalStyle` (*Balanced, Attacking, Defending, Gegenpress, Control Possession, Tiki-Taka, Vertical Tiki-Taka, Wing Play, Route One, Fluid Counter-Attack, Direct Counter-Attack, Catenaccio*, dll.) lengkap dengan `Mentality`, `DefensiveBlock`, `Attributes`, formasi yang diizinkan (`Allows`), dan array bit *Team Instructions*.
   - 8 `Shapes` default & 16 pasangan `StyleShapes` dua fase (contoh: `4-2-3-1 -> 4-4-1-1`, `4-3-3 DM -> 4-1-4-1`, `3-4-2-1 -> 5-2-2-1`, `3-5-2 -> 5-3-2`).
5. **`training-sessions.json` & `training-presets.json`**:
   - Entri sesi latihan: `code`, `name`, `category`, `max_sessions_per_week`, dampak (`condition`, `fatigue`, `happiness`, `injuries`, `sharpness`), dan daftar `attributes` per unit (`attacking`, `midfield`, `defending`, `goalkeeping`).
   - Preset jadwal mingguan FM27 (Pre-Season, Normal 1-Match, Congested 2-Match, Wonderkid Development).
6. **`staff-formulas.json`, `staff-seed.json` & `wonderkids-seed.json`**:
   - Rumus terparameterisasi untuk 10 kategori bintang latihan staf (`DDM` multiplier + bobot primer/sekunder + tabel ambang 0.5-5.0 bintang).
   - Minimal 150+ entri kurasi awal wonderkids U-21 dan kurasi staf terbaik / free agents untuk seeding database dan mode demo instan.

---

## 6. Spesifikasi Codec Biner `.fmf` / `.tac` (`packages/fm-codec`)

Implementasikan 100% di TypeScript murni menggunakan `Uint8Array`, `DataView` (Little-Endian), `BigInt`, `fzstd`, Web Crypto API, dan `lz-string`. Verifikasi setiap offset terhadap `03-format-biner-fmf-dan-save-reader.md` & `06-reconstructed-code/` dari Google Drive REA.

### A. Encoder Ekspor `.fmf` (`exportFmf`)
1. **Validasi Pra-Ekspor (`validatePhase` & `validatePlan`):**
   - Pastikan tepat 11 pemain pada fase *In Possession* dan 11 pada fase *Out of Possession*.
   - Validasi setiap bit *Team Instruction* terhadap `pitch-catalog.json` dan tolak/selesaikan jika terdapat pasangan bit yang berkonflik di `Conflicts`.
2. **Serialisasi `.tac` (`tac-serializer.ts`):**
   - Tulis `PlanHeader`: `22 44 00 1b 00 01 00 01`.
   - Tulis judul taktik, 1 byte `Mentality` (`1-7`), dan **12-byte bitfield (96 bit)** untuk seluruh *Team Instructions* aktif.
   - Tulis penanda pemisah `FF 00 4C 4C 55 4E` (`"LLUN"`).
   - Tulis **11 pasang slot pemain** mengikuti `PhaseOrder`: tiap slot diawali `SlotHeader` (`44 00 02`), 32-bit `Position.Mask`, 64-bit `Role.Flags`, 64-bit bitfield *Player Instructions* + mask posisi *marking*, serta nilai `ActiveRole` yang menyisipkan bit *Duty*:
     - `Defend = 0x200000`
     - `Support = 0x400000`
     - `Attack = 0x800000`
   - Akhiri payload `.tac` dengan blok biner `DefaultPreferences` (ambil byte eksak dari REA).
3. **Metadata `_data/details.aom` (`details-aom.ts`):**
   - Tulis header `03 01 6d 6f 61 2e 04 00` (`moa.`), handler `"TACTICS_TYPE_HANDLER"`, judul, deskripsi taktik, author, dan 10-byte GUID acak unik (`crypto.getRandomValues(new Uint8Array(10))`).
4. **Pure-TS Zstandard Raw Frame (`zstd-raw-frame.ts`):**
   - Bungkus `.tac`, `_data/details.aom`, dan direktori TOC ke dalam Zstandard Frame valid dengan magic bytes `28 B5 2F FD A0` + panjang payload 4-byte + **Raw Blocks (`Block_Type = 0`, tanpa kompresi)** per blok 64 KB sehingga 100% terbaca oleh parser Zstd Football Manager tanpa DLL native.
5. **Pengemasan Kontainer `.fmf` (`fmf-archive.ts`):**
   - Tulis `ArchiveHeader` `02 01 66 6d 66 2e 08 00 00` (`fmf.`) + 64-bit offset ke direktori akhir -> frame `<judul>.tac` -> frame `_data/details.aom` -> ulang `ArchiveHeader` -> frame TOC (nama member, offset, ukuran, Unix timestamp).

### B. Decoder Impor `.fmf` (`parseFmf`), `.fm27.json` & URL Share
- **Deteksi Header `.fmf`:**
  - `02 01 66 6d 66 2e 08 00 00` (`fmf.`): baca TOC akhir -> dekompresi frame `.tac` & `details.aom` menggunakan `fzstd`.
  - `02 01 61 66 65 2e 08 00 00` (`afe.` terenkripsi): jalankan modul `aes-ctr-decrypt.ts` (AES-128-CTR via Web Crypto API) sebelum dekompresi `fzstd`.
- **Format `.fm27.json`:** Skema terbuka lengkap (versi skema, versi patch FM27, metadata, 11 slot IP/OOP, Mentality, TI, PI) divalidasi Zod.
- **Berbagi URL Terkompresi (`url-share.ts`):** Serialize payload ringkas ke tuple array padat -> kompresi dengan `LZString.compressToEncodedURIComponent()` -> hash `#t=<encoded>` yang otomatis membuka taktik di papan tanpa butuh login/database.

---

## 7. Spesifikasi Mesin Logika Deterministik & Analitik (`packages/fm-engine`)

Seluruh modul di bawah ini wajib dieksekusi di dalam **Web Worker** (`engine.worker.ts`) agar UI selalu 60fps. Verifikasi detail konstanta & *edge-case* terhadap `02-algoritma-inti-pembuatan-taktik.md` dan `06-reconstructed-code/` dari Google Drive REA.

### A. Mesin Optimasi Skuad & Penilaian Taktik Inti
1. **Validasi & Normalisasi (`normalizer.ts`):**
   - Cek minimal 11 pemain (minimal 1 GK dengan familiaritas GK $\ge 15/20$ dan minimal 10 outfield), maksimal 11 starter yang dikunci user (`LineupPreference`).
   - Jika input memakai skala internal `0-125` (`raw_*`), konversi ke `1-20`:
     $$\text{attr} = \min\!\left(20,\ \frac{\text{raw}}{5}\right)$$
2. **Pemilihan Role Terbaik (`role-evaluator.ts`):**
   - Hitung rata-rata 5 atribut kunci role (`average(role.keys)`).
   - Bonus kaki terbalik khusus `InsideForward`:
     $$+(\text{left\_foot} - \text{right\_foot}) \times (-0.12\text{ di AML atau }+0.12\text{ di AMR})$$
   - Ambang role spesialis (`BallKeeper`, `BallBack`, `WingBack`, `DeepPlaymaker`, `MidPlaymaker`, `AdvancedPlaymaker`): kurangi `0.45`.
   - Bonus sinergi gaya main: $+0.20 \times |\text{role.keys} \cap \text{style.attributes}|$.
3. **Skor Kecocokan Slot (`fit-calculator.ts`):**
   - Familiaritas dua fase:
     $$\text{posScore} = 0.65 \cdot \frac{\text{inFam} + \text{outFam}}{2} + 0.35 \cdot \min(\text{inFam}, \text{outFam})$$
   - Kualitas role rata-rata dua fase: $\overline{Q} = \frac{q_{\text{in}} + q_{\text{out}}}{2}$
   - Mode Standar (`fullProfile = false`):
     $$\text{raw} = 0.55 \cdot \text{posScore} + 0.35 \cdot \overline{Q} + 0.10 \cdot \text{Ability}$$
   - Mode Full Profile (`fullProfile = true`):
     $$\text{raw} = 0.46 \cdot \text{posScore} + 0.26 \cdot \overline{Q} + 0.18 \cdot \text{Ability} + 0.10 \cdot \text{OverallAttributes}$$
   - Skala `0-100` dengan penalti *out-of-position*:
     $$\text{Fit} = 5 \cdot \text{raw} - 1.5 \cdot \max(0,\ 14 - \min(\text{inFam}, \text{outFam}))$$
   - Penalti keras `-1000` jika kiper dipasangkan ke slot outfield atau sebaliknya.
4. **Penugasan Optimal 11 Inti (`hungarian.ts`) & Optimasi Lokal (`local-refiner.ts`):**
   - Bentuk matriks $11 \times N$; untuk pemain outfield saat gaya main aktif, baurkan $0.90 \cdot \text{Fit} + 0.10 \cdot \text{styleRating}$; tambahkan $+10000$ untuk starter yang dikunci user.
   - Jalankan **Algoritma Hungarian (Kuhn-Munkres)** $O(n^2 m)$ untuk mendapatkan total skor maksimum global.
   - Evaluasi cadangan untuk menghitung `CoverFit`, lalu jalankan `refine()` (uji tukar starter <-> reserve dan swap slot/role terhadap aturan kepelatihan).
5. **Instruksi, Coaching Review & Ranking Akhir (`instruction-planner.ts`, `coaching-review.ts`):**
   - Baseline adaptif (`Mentality = Positive` jika $\text{BuildUp} \ge 13$ & `HighPress`, selain itu `Balanced`; instruksi dasar dari ambang $\text{BuildUp} \ge 13$, $\text{Recovery} < 11$, duel udara $\ge 14$) -> overlay `TacticalStyle` -> overlay `TacticalPriorities` -> selesaikan konflik bit via `PitchCatalog.Conflicts` -> rekomendasikan PI per slot/pemain IP & OOP.
   - Evaluasi aturan kepelatihan (`coaching-knowledge.json`):
     $$\text{CoachingAdjustment} = 6 \cdot \tanh\!\left(\frac{\sum w_i (r_i - t_i)}{3.5 \sum w_i}\right)$$
   - Jalankan auto-koreksi saat metrik di bawah ambang `Below` (contoh: *Gegenpress* $\text{press} < 12.5$ menurunkan *Trigger Press* bit `65 -> 66`) dan hitung `InstructionPenalty` saat tuntutan instruksi melebihi `PressCapacity` ($< 13$) atau `Recovery` ($< 12.5$).
   - Skor akhir:
     $$\text{SquadFit} = 0.94 \cdot \text{StartingFit} + 0.06 \cdot \text{CoverFit} - \text{PressCost}$$
     $$\text{RankingFit} = \bigl(0.90 \cdot \text{SquadFit} + 0.10 \cdot \text{PhilosophyFit} + \text{CoachingAdjustment}\bigr) - \text{InstructionPenalty}$$
   - Tambahkan penanda *Near-Tie Comparison* bila selisih peringkat #1 dan #2 $< 0.1$.

### B. Mesin Analitik Baru (Improvisasi)
1. **Heatmap 18 Zona (`heatmap-18zone.ts`):** Membagi lapangan menjadi grid 6 baris x 3 kanal vertikal (menyorot **Zone 14** & **Half-Spaces**). Menghitung intensitas kehadiran pemain secara terpisah untuk fase IP, OOP, dan Transisi berdasarkan koordinat slot, vektor gerak Role, bobot Duty (`Defend/Support/Attack`), *Attacking Width*, dan *Defensive Line*.
2. **Tactical Balance Score (`balance-scorer.ts`):** Menghasilkan skor `0-100` pada 6 pilar (*Attacking Threat, Build-Up Progression, Rest-Defense Stability, Width & Half-Space Coverage, Pressing Cohesion, Transition Resilience*) + daftar peringatan celah otomatis (gabungan deteksi spasial 18-zona + `CoachingFindings` lengkap dengan sitasi UEFA/FIFA).
3. **Squad Audit & Instant Replacement (`squad-audit.ts`):** Menghitung Role Fit Score tiap starter terhadap taktik aktif (baik taktik manual maupun hasil generator), menyorot 3 posisi terlemah + selisih atribut kunci, lalu menyarankan pengganti internal (cadangan/U21), alternatif Role yang lebih cocok, atau *deep-link* filter ke modul Wonderkids.
4. **Wonderkids Ranker (`wonderkid-ranker.ts`):** Menghitung `RoleFitScore` wonderkid terhadap slot target/terlemah dan:
   $$\text{ValueRatio} = 0.55 \cdot \text{RoleFit} + 0.30 \cdot \text{PotentialScore} + 0.15 \cdot \text{PriceEfficiency}$$
5. **Staff Star Calculator & Optimizer (`staff-calculator.ts`):** Menghitung 0.5-5.0 bintang (langkah 0.5) untuk seluruh 10 kategori latihan berbasis formula di `staff-formulas.json`, ditambah solver alokasi staf optimal untuk memaksimalkan bintang dengan beban kerja (*Workload*) **Light/Average**.
6. **Training Recommender (`training-recommender.ts`):** Memetakan atribut terlemah dari Audit Skuad atau profil pertumbuhan wonderkids ke sesi latihan di `training-sessions.json`, memvalidasi batas `max_sessions_per_week`, serta menghitung akumulasi mingguan `condition`, `fatigue`, `happiness`, `injuries`, dan `sharpness`.

---

## 8. Spesifikasi Integrasi AI Gemini (`packages/ai-analyst`)

Seluruh pemanggilan Gemini API WAJIB berjalan di **Server-Side** (Next.js Route Handlers) menggunakan **`@google/genai >= 3.2.0`**:

1. **Asisten Taktik Interaktif (`tactical-advisor.ts` — Interactions API `v1`):**
   - Inisialisasi: `new GoogleGenAI({})` (mengambil `GEMINI_API_KEY` dari env).
   - **Model:**
     - `gemini-4-hydrogen`: model default untuk review taktik real-time & Q&A taktik.
     - `gemini-4-neon`: mode opsional **"Deep Match Audit"** untuk analisis mendalam pra-pertandingan atau bedah skuad penuh.
     - `gemini-3.5-flash-lite`: saran mikro cepat (tooltip penjelasan role/konflik instruksi).
   - **Streaming & Multi-Turn:** Gunakan `client.interactions.create({ model, system_instruction, input, previous_interaction_id, stream: true })`. Proses event `event.event_type === "step.delta"` (`event.delta.type === "text"`) untuk streaming SSE ke frontend, dan kembalikan `interaction.id` dari `interaction.completed` agar user dapat bertanya lanjut (*follow-up*) tanpa mengirim ulang seluruh riwayat percakapan.
   - **Anti-Halusinasi:** Selalu suntikkan ringkasan JSON terstruktur dari `fm-engine` (formasi IP/OOP, role, TI/PI aktif, skor 18 zona, celah struktural, dan profil skuad jika ada) pada giliran pertama.

2. **Moderasi & Auto-Tagging Galeri (`community-moderator.ts` — Decisions API `v1beta`):**
   - Inisialisasi: `new GoogleGenAI({ apiVersion: "v1beta" })`.
   - Model: `gemini-decision-1` via `aiBeta.decisions.create(...)` (0 output tokens, probabilitas terkalibrasi).
   - Evaluasi paralel dalam 1 panggilan:
     - `is_safe_content` (`type: "noul"`): deteksi spam/konten tidak pantas.
     - `playstyle_tag` (`type: "choice"`): klasifikasi gaya bermain otomatis (*gegenpress, possession, counter, wing_play, balanced*).
     - `guide_quality` (`type: "score"`): rubrik kelengkapan deskripsi taktik untuk membantu kurasi *Featured Tactics*.

3. **Pencarian Semantik Galeri (`semantic-search.ts` — Embeddings):**
   - Gunakan `gemini-embedding-2` via `client.models.embedContent` untuk menghasilkan vektor pencarian natural language (contoh: *"taktik 3 bek aman buat tim papan tengah"*) yang dicocokkan dengan kolom `pgvector` di Supabase.

---

## 9. Spesifikasi UI/UX & 9 Fitur Web (`apps/web`)

Gunakan estetika **Modern Tactical Analytics Dark Mode** (`#0B0F19` background, `#111827` surface cards, `#10B981` emerald pitch accent, `#06B6D4` cyan untuk fase **IP**, `#F59E0B` amber untuk fase **OOP**, `#F43F5E` rose untuk peringatan celah; font *Plus Jakarta Sans* + *JetBrains Mono* untuk angka atribut/metrik).

1. **Tautan Folder Lokal (`local-folder-sync.ts`):**
   - Tombol **"Connect FM27 Folder"** memakai `window.showDirectoryPicker({ mode: 'readwrite' })`.
   - Simpan `FileSystemDirectoryHandle` ke IndexedDB (`idb-keyval`) dengan verifikasi izin otomatis (`queryPermission` / `requestPermission`) saat sesi dibuka kembali.
   - Aksi 1-klik: simpan `.fmf` langsung ke `/tactics/`, baca daftar `.fmf` dari `/tactics/`, simpan jadwal ke `/schedules/`, dan ekspor shortlist ke `/shortlists/`.
   - Deteksi kapabilitas browser otomatis: jika Firefox/Safari, tampilkan mode fallback drag-and-drop & standard download tanpa pesan error.
2. **Papan Taktik Dual-Phase (`components/pitch/`):**
   - SVG lapangan responsif dengan 24 titik snap resmi (`pitch-catalog.json`).
   - Switcher 3 mode: **`In-Possession`**, **`Out-of-Possession`**, dan **`Split View`** (side-by-side tersinkronisasi: hover/seleksi pemain #N di IP langsung menyorot pemain #N di OOP + menampilkan garis vektor transisi & indikator jarak perpindahan).
   - Deteksi formasi otomatis real-time di kedua fase (misal `IP 4-2-3-1 DM -> OOP 4-4-2`).
   - Panel Mentality (7 level), Team Instructions (29 grup, highlight otomatis jika ada konflik `Conflicts`), dan Player Instructions (17 grup sesuai `PlayerInstructionPolicies`).
   - Undo/Redo penuh (`Ctrl+Z` / `Ctrl+Y`) via Zustand middleware.
3. **Impor, Ekspor & Berbagi:**
   - Impor `.fmf`, `.fm27.json`, atau tautan URL `#t=...`.
   - 13+ Preset Taktik siap pakai dari `tactical-styles.json`.
   - Ekspor ke `.fmf` (unduh atau langsung ke folder lokal), `.fm27.json`, kartu PNG siap bagikan, dan tombol **"Copy Share Link"** (URL terkompresi).
4. **Analisis Taktik & Asisten AI:**
   - Overlay toggle **Heatmap 18 Zona** langsung di atas papan taktik (mode IP / OOP / Transisi).
   - Panel **Tactical Balance Score** (Radar 6 pilar) + kartu peringatan celah otomatis (termasuk tombol **"Apply Auto-Fix"** untuk saran koreksi dari `CoachingKnowledge.Adjustments`).
   - Slide-over **AI Tactical Assistant Drawer** dengan tombol quick prompts (*"Audit Kelemahan"*, *"Counter 4-3-3 Gegenpress"*, *"Sesuaikan untuk Tim Underdog"*) dan chat streaming multi-turn.
5. **Audit Skuad (`/squad`):**
   - Impor cepat mendukung 3 format nyata FM27:
     1. CSV keluaran `fmsave` (`players.csv` / `squad.csv` dengan kolom wajib `uid`, `name`, `club_uid`, `club_name`, `team_id`, `team_slot`).
     2. CSV / HTML keluaran plugin `FM-View-Exporter` (tombol `F9` di FM27) maupun export HTML legacy.
     3. Auto-load file export dari folder lokal FM27 yang tertaut.
   - Mode **Auto-Generate Best Tactic** (menjalankan Hungarian Solver ke 13 gaya x 16 `StyleShapes` dengan opsi *Lineup Locks* & *Tactical Priorities*) dan mode **Audit Taktik Aktif**.
   - Tampilkan kartu **3 Posisi Terlemah**, tabel Role Fit Score semua pemain, dan modal **Pengganti Instan** (Tab Internal Squad + Tab Rekomendasi Wonderkids terfilter otomatis).
6. **Wonderkids (`/wonderkids`):**
   - Tab **Best For My Tactic**: mengurutkan wonderkids berdasarkan `RoleFitScore` pada slot terlemah/terpilih & `ValueRatio` (harga vs potensi).
   - Tab **Trending Mingguan**: daftar wonderkids paling diminati komunitas dalam 7 hari terakhir (badge rank naik/turun).
   - Filter posisi, usia, budget maksimum, gaya main + tombol **Add to Shortlist** & ekspor shortlist.
7. **Staff Calculator & Finder (`/staff`):**
   - Kalkulator interaktif input atribut staf -> langsung menampilkan 10 skor bintang 0.5-5.0 (terkalibrasi terhadap `FM_Staff_Scores`).
   - Impor staf klub/pencarian (CSV/HTML) atau jelajahi direktori kurasi **Best Staff & Free Agents**.
   - **Auto-Assign Optimizer**: membagi tugas pelatih agar total bintang maksimal & workload tetap *Light/Average*.
8. **Saran & Jadwal Latihan (`/training`):**
   - Panel **Smart Recommendations** yang membaca atribut terlemah skuad atau daftar wonderkids terpilih.
   - Grid interaktif **7 Hari x 3 Sesi** drag-and-drop dengan meteran real-time (*Condition, Fatigue, Injury Risk, Sharpness, Happiness*) serta peringatan otomatis saat melebihi `max_sessions_per_week`.
   - Preset jadwal mingguan dari `training-presets.json` (referensi `fm-scoring`) + Impor/Ekspor jadwal.
9. **Galeri Komunitas (`/community`):**
   - Tab kategori: **Tactics**, **Training Schedules**, **Wonderkid Shortlists**.
   - **Auto-Visual Preview `.fmf`:** Saat user mengunggah file `.fmf`, client & server mem-parsing biner melalui `fm-codec` untuk mengekstrak formasi IP/OOP, Mentality, Style, dan menyimpan data preview SVG Dual-Phase otomatis tanpa perlu upload screenshot manual.
   - Filter patch (`v27.0`, `v27.3`, dst.), formasi, gaya main, *Top Upvoted*, *Trending*, plus pencarian semantik.
   - Aksi: **Upvote**, **Bookmark**, **Load to Pitch Board**, **Download `.fmf`**.

---

## 10. Skema Database Supabase (`supabase/migrations/`)

Buat 3 file migrasi SQL terstruktur:
1. **`0001_initial_schema.sql`**:
   - `profiles` (`id`, `username`, `avatar_url`, `created_at`)
   - `community_tactics` (`id`, `author_id`, `title`, `description`, `game_version`, `ip_formation`, `oop_formation`, `playstyle_tag`, `mentality`, `tactic_json`, `fmf_storage_path`, `balance_score`, `upvotes_count`, `bookmarks_count`, `downloads_count`, `moderation_status`, `embedding vector(768)`, `created_at`)
   - `community_schedules` (`id`, `author_id`, `title`, `focus_tags`, `game_version`, `schedule_json`, `upvotes_count`, `bookmarks_count`, `created_at`)
   - `wonderkids` (`id`, `uid`, `name`, `age`, `club`, `nationality`, `positions text[]`, `estimated_price`, `pa_range`, `attributes_json`, `game_version`, `is_curated`, `updated_at`)
   - `community_shortlists` (`id`, `author_id`, `title`, `description`, `wonderkid_ids uuid[]`, `game_version`, `upvotes_count`, `bookmarks_count`, `created_at`)
   - `user_interactions` (`id`, `user_id`, `target_type`, `target_id`, `action_type` — enum `'upvote' | 'bookmark'`, `created_at` + unique constraint)
   - `analytics_events` (`id`, `entity_type`, `entity_id`, `event_type` — enum `'view' | 'bookmark' | 'shortlist_add' | 'upvote' | 'download'`, `created_at`)
2. **`0002_rls_policies.sql`**:
   - Read publik untuk konten berstatus `approved`; Write/Update/Delete terbatas pada `auth.uid() = author_id`; proteksi rate-limit & anti-spam untuk `analytics_events`.
3. **`0003_trending_and_vectors.sql`**:
   - Materialized View `weekly_trending_wonderkids`: menghitung skor tren 7 hari terakhir dengan *time-decay* berbobot:
     $$\text{TrendScore} = \sum_{e \in \text{7d}} \frac{W(e)}{(1 + \text{hours\_since}(e)/24)^{1.5}}$$
     (bobot: `view = 1`, `bookmark = 4`, `shortlist_add = 6`, `upvote = 5`).
   - Index HNSW pada `community_tactics.embedding` untuk pencarian semantik instan.

---

## 11. Workflow Integrasi, Update & Maintenance Jangka Panjang

Rancang repositori agar setiap pembaruan (patch FM27, tweak formula, fitur baru, atau upgrade model AI) bisa dilakukan dengan cepat, aman, dan minim regresi:

| Skenario Maintenance | Langkah Workflow | File yang Disentuh | Verifikasi Otomatis (CI) |
| :--- | :--- | :--- | :--- |
| **Patch FM27 Baru (Role/Bitmask/TI Baru)** | Jalankan `pnpm data:new-patch 27.3 --from 27.0`, edit JSON baru, update `defaultVersion` | Hanya `packages/fm-data/versions/v27.3/*` | `data-validation.yml` (Zod + integritas bitmask & conflicts) |
| **Update Database Wonderkids / Free Agents** | Edit `wonderkids-seed.json` / `staff-seed.json` lalu jalankan `pnpm db:seed` | `packages/fm-data` + `scripts/seed-db.mjs` | Validasi skema + cek duplikasi UID |
| **Kalibrasi Rumus Bintang Staff / Heatmap** | Ubah bobot di `staff-formulas.json` atau konstanta bobot di `fm-engine` | `packages/fm-data` atau `packages/fm-engine` | `ci.yml` -> Vitest regression tests |
| **Upgrade Model Gemini API** | Ubah konstanta model di 1 file konfigurasi terpusat `packages/ai-analyst/src/client.ts` | `packages/ai-analyst/src/client.ts` | Smoke test API contract |
| **Perubahan Format Biner `.fmf` Game Baru** | Tambah *codec version strategy* baru di `packages/fm-codec` tanpa merusak v27.0 | `packages/fm-codec/src/` + `tests/fixtures/` | Vitest binary round-trip (`export -> parse === original`) |

### Konvensi Git & Rilis
- Gunakan **Conventional Commits** (`feat(codec): ...`, `fix(engine): ...`, `data(v27.3): ...`, `chore(ci): ...`).
- Dokumentasikan setiap perubahan di `CHANGELOG.md` dan simpan panduan operasional lengkap di `docs/MAINTENANCE_WORKFLOW.md`.
- Jalankan audit hutang teknis (`shortcut:` ledger gaya Ponytail) sebelum setiap rilis minor.

---

## 12. Roadmap Eksekusi Otomatis Bertahap (6 Fase + Verification Gates)

Kerjakan pembangunan secara berurutan dari **Fase 0 hingga Fase 6**. Jangan melompati fase. Di akhir setiap fase: (1) jalankan **Verification Gate**, (2) jalankan checklist **`ponytail-review`** terhadap diff fase tersebut, (3) laporkan hasil secara ringkas (gaya **Caveman**), dan (4) buat commit checkpoint sebelum lanjut ke fase berikutnya.

- **FASE 0 — Remote Bootstrap, Agent Skills, Monorepo Scaffold & Data Registry:**
  - Buat `.gitignore` (wajib blokir `_reference/`, `.env*`, `/tmp/`), `AGENTS.md` (aturan terpadu Precedence + Ponytail + Caveman + GDrive Read-Only Guard), dan pasang skill proyek `.agents/skills/caveman` (skill-only, tanpa proxy) & `.agents/skills/ponytail`.
  - Buat struktur Turborepo + pnpm, konfigurasi TypeScript strict, `packages/shared-types`, seluruh skrip di `scripts/`, lalu ekstrak data nyata dari Google Drive REA (`05-data-schemas/`) ke `packages/fm-data/versions/v27.0/` (fallback `--seed-defaults` jika GDrive belum termount).
  - *Gate:* `pnpm data:validate && pnpm typecheck` lolos 100%.

- **FASE 1 — Binary Codec `.fmf` & Mesin Deterministik Inti (`fm-codec` + `fm-engine`):**
  - Baca **hanya** `03-format-biner-fmf-dan-save-reader.md`, `02-algoritma-inti-pembuatan-taktik.md`, dan file target di `06-reconstructed-code/` dari Google Drive REA.
  - Implementasi penuh `.fmf`/`.tac`/`details.aom`/Zstd Raw Frame/AES-CTR/`.fm27.json`/URL compressor, serta seluruh mesin `SquadAnalysis` (normalizer, BestRole, Fit, Hungarian, Refine, CoachingReview, InstructionPenalty, RankingFit), 18-Zone Heatmap, Balance Score, Staff Calculator, Wonderkid Ranker, dan Training Recommender.
  - *Gate:* `pnpm test` lulus 100% termasuk **binary round-trip `.fmf`** dan uji regresi Hungarian Solver + `ponytail-review`.

- **FASE 2 — Dual-Phase Pitch Board, Preset & Local Folder Sync (`apps/web`):**
  - Bangun layout Dark Tactical UI, `engine.worker.ts`, Zustand store (undo/redo), Papan Taktik IP/OOP/Split View drag-and-drop dengan deteksi formasi otomatis, panel TI/PI anti-konflik, 13+ preset, URL sharing, dan integrasi **File System Access API** (+ fallback Safari/Firefox).
  - *Gate:* `pnpm build` lolos; ekspor `.fmf` & tautan folder lokal teruji.

- **FASE 3 — Heatmap 18 Zona, Analisis Celah & Asisten AI Gemini (`ai-analyst`):**
  - Integrasikan overlay Heatmap 18 Zona, Radar Balance Score, kartu peringatan + tombol *Auto-Fix*, serta `packages/ai-analyst` (`@google/genai >= 3.2.0` Interactions API streaming `gemini-4-hydrogen` + multi-turn `previous_interaction_id` + opsi `gemini-4-neon`).
  - *Gate:* Streaming SSE `/api/ai/tactical-review` teruji dan graceful fallback aktif saat `GEMINI_API_KEY` kosong.

- **FASE 4 — Audit Skuad, Wonderkids, Kalkulator Staff & Jadwal Latihan (+ 3 GitHub Refs):**
  - Baca `04-modul-pendukung-dan-fitur-sekunder.md` dari Google Drive REA.
  - Lakukan *shallow clone* sementara ke `/tmp/fm-refs/` untuk 3 repo GitHub (`ElectroHugin/FM-View-Exporter`, `HansMellman/FM_Staff_Scores`, `jamiebolden/fm-scoring`), ekstrak format parser FM27 `F9`, kalibrasi `staff-formulas.json`, dan susun `training-presets.json`, lalu hapus `/tmp/fm-refs/`.
  - Bangun halaman `/squad`, `/wonderkids`, `/staff`, dan `/training` yang saling terhubung lintas-halaman.
  - *Gate:* `pnpm data:validate && pnpm test && pnpm build` lolos; `/tmp/fm-refs/` sudah bersih terhapus.

- **FASE 5 — Galeri Komunitas, Supabase, Trending Mingguan & Moderasi AI:**
  - Terapkan migrasi SQL Supabase (`0001`-`0003`), Auth, unggah `.fmf` dengan **auto-generated SVG Dual-Phase preview**, Upvote/Bookmark, `weekly_trending_wonderkids`, moderasi & auto-tagging via `gemini-decision-1` (`v1beta`), serta pencarian semantik `gemini-embedding-2`.
  - *Gate:* End-to-end flow upload `.fmf` -> auto preview -> load to board -> download `.fmf` sukses.

- **FASE 6 — CI/CD, Dokumentasi Maintenance & Hardening Produksi:**
  - Buat `.github/workflows/ci.yml`, `data-validation.yml`, `sync-trending.yml`, PWA manifest, serta dokumentasi lengkap `docs/ARCHITECTURE.md`, `docs/BINARY_FMF_SPEC.md`, dan `docs/MAINTENANCE_WORKFLOW.md`.
  - Jalankan audit akhir `ponytail-audit` (cek celah keamanan, RLS, error boundary, dan ledger komentar `shortcut:`).
  - *Gate:* Seluruh pipeline `pnpm lint && pnpm typecheck && pnpm test && pnpm build` hijau tanpa error.

---

## 13. Instruksi Mulai Otomatis untuk Antigravity Web / Remote

Eksekusi **FASE 0** sekarang secara otomatis mengikuti seluruh batasan di Bagian 1 & 2:
1. Deteksi path folder Google Drive REA (`fm-tactic-generator/`) yang tertaut di workspace (jangan modifikasi isinya; abaikan `extracted-runtime/` & `07-rea-evidence/`).
2. Buat `.gitignore`, `AGENTS.md`, dan pasang skill proyek `.agents/skills/caveman` (skill-only) + `.agents/skills/ponytail`.
3. Bangun fondasi monorepo, `packages/shared-types`, skrip di `scripts/`, dan ekstrak data nyata dari `05-data-schemas/` ke `packages/fm-data/versions/v27.0/`.
4. Jalankan Verification Gate (`pnpm data:validate && pnpm typecheck`) dan laporkan hasilnya secara ringkas sebelum lanjut ke **FASE 1**.