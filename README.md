# ESAINA — Explainable Essay Assessment Platform

Penilaian esai dengan saran AI yang bisa diperiksa: AI menyiapkan draf skor, alasan, kutipan, dan umpan balik — guru yang memutuskan.

Tim Kopsudomar · INCEPTION 2026 · Subtema: Inclusive Education and Future Skills

**Stack:** Next.js 16 · TypeScript · Tailwind v4 · shadcn/ui + Base UI · TanStack Query/Table · NextAuth.js v4 · Prisma 7 · Supabase PostgreSQL · Vitest

---

## Masalah & solusi

Guru menghabiskan banyak waktu menilai esai, dan alat bantu AI yang ada biasanya memberi satu angka akhir tanpa menjelaskan dasarnya — sulit dipercaya, sulit dikoreksi. Siswa pun sering menerima nilai tanpa tahu bagian mana yang dinilai.

ESAINA memecah penilaian menjadi saran per soal dan per kriteria rubrik. Setiap saran membawa alasan, kutipan persis dari jawaban siswa, dan umpan balik, lalu divalidasi server. Guru dapat memakai, mengubah, atau mengabaikannya, mengesahkan nilai, dan baru setelah itu menerbitkan hasil ke siswa. Total skor selalu dihitung server dari nilai guru.

## Demo

| Item | Tautan |
|---|---|
| Aplikasi live | `<isi-url-demo>` |
| Video demo (≤3 menit) | `<isi-url-video>` |
| Repositori | https://github.com/kopsudomar/esaina |

Akun demo (hasil seed, data sintetis):

| Peran | Email | Sandi |
|---|---|---|
| Guru | `guru@demo.sch.id` | `demo1234` |
| Siswa | `s001@demo.sch.id` … `s004@demo.sch.id` | `demo1234` |
| Admin | `admin@demo.sch.id` | `demo1234` |

Status deploy: **belum selesai** (menunggu import repo di Vercel + set env). Lihat `docs-ai/progress.md`.

Rilis yang dinilai akan ditandai dengan tag **`submission-24h`** (belum dibuat).

## Fitur utama

### Guru
- Kelas dengan kode bergabung; asesmen berisi soal, jawaban acuan, dan rubrik per soal.
- Buka/tutup asesmen; isi soal dan rubrik terkunci setelah dibuka (perubahan lewat salin menjadi draf baru).
- Daftar LJK dengan pencarian dan filter status (belum mengumpulkan / dikumpulkan / draf / final / terbit).
- Halaman penilaian: jawaban siswa di kiri, rubrik dan input nilai di kanan; simpan draf parsial.
- "Minta saran AI untuk LJK" — draf per soal+kriteria, dengan label AI, alasan, kutipan, feedback.
- "Gunakan saran AI" per soal (setelah konfirmasi) atau nilai manual; semua nilai tetap bisa diedit.
- "Sahkan & siswa berikutnya": pengesahan atomik satu LJK, lalu lanjut ke LJK berikutnya yang sudah dikumpulkan dan belum final.
- Rekap, publikasi LJK Final terpilih, ekspor CSV untuk LJK Final, dan revisi nilai Final (draf baru → sahkan → terbitkan ulang).
- Riwayat audit: SUBMIT, APPLY_AI, CHANGE_GRADE, APPROVE, PUBLISH, DELETE.

### Siswa
- Bergabung kelas dengan kode; melihat asesmen yang dibuka.
- Isi jawaban per soal, autosave + tombol simpan draf, indikator Menyimpan/Tersimpan/Gagal disimpan.
- Konfirmasi pengumpulan (menyebut jumlah jawaban kosong); LJK terkunci dalam satu transaksi.
- Lihat nilai per soal, total, dan umpan balik guru **hanya setelah** hasil diterbitkan.

### Admin (tambahan)
- Kelola pengguna (buat, aktif/nonaktif), KPI, dan monitoring progres asesmen.

### Alur ujung-ke-ujung
Buat asesmen → siswa mengerjakan & mengumpulkan → guru meminta saran AI → guru meninjau/mengubah → sahkan → terbitkan → siswa melihat hasil.

## Prinsip: AI hanya memberi saran, guru memutuskan

`AIResult` disimpan terpisah dari `GradeRevision`. AI tidak dapat mengisi, menimpa, mengesahkan, atau menerbitkan nilai. Saran yang gagal validasi tidak dapat diterapkan; jalur manual selalu tersedia.

Invarian produk yang dijaga di kode:

| Invarian | Penerapan |
|---|---|
| Otorisasi di server setiap route | Guard sesi + peran + kepemilikan kelas di Route Handler dan layout; `proxy.ts` hanya redirect optimistik |
| Allowlist payload siswa | DTO allowlist; acuan, rubrik internal, draf AI, dan nilai siswa lain tidak pernah dikirim |
| Total skor dihitung server | Diturunkan dari `GradeItem` milik guru, bukan dari model atau klien |
| Validasi keluaran AI | Skema/tipe benar, tiap soal & kriteria tepat sekali, tanpa ID asing, skor sesuai rubrik, `evidence` kutipan persis (normalisasi whitespace); retry maksimal 1x |
| Nilai kosong ≠ nol | Siswa belum mengumpulkan tidak diberi nol dan tidak diekspor sebagai nol |
| Konkurensi | Mutasi membawa `expected_version` → 409 saat konflik; submit/approve/publish memakai transaksi + idempotency key |

## Arsitektur

```
Browser (guru/siswa/admin)
   │  Next.js App Router (RSC + Route Handlers)
   │  ├─ auth + guard peran/kepemilikan  → NextAuth (JWT)
   │  ├─ validasi AI + prompt + adapter   → LLM API (provider via env)
   │  └─ grading / publikasi / revisi
   └─ Prisma 7 (@prisma/adapter-pg) ──→ Supabase PostgreSQL (TLS + root CA)
```

Kunci LLM dan kredensial DB hanya di server. Saran AI berjalan sinkron dalam request; job-lock per LJK masih per-proses.

### Struktur folder (kondisi repo)

```
prisma/
  schema.prisma            model data + enum
  migrations/              migrasi SQL
  seed.ts                  data demo (guru, siswa, admin, kelas, asesmen)
src/
  app/
    login/                 halaman masuk
    guru/                  kelas, asesmen, submissions, grading, rekap
    siswa/                 kelas, assessment/[id], results/[id]
    admin/                 users, monitoring
    api/
      auth/[...nextauth]/  NextAuth handler
      classes/             buat, gabung, daftar, detail
      assessments/         CRUD, open, submissions, submit, work, export, publish
      submissions/[id]/    detail, ai, ai/apply, grade, grade/finalize, grade/revise
      student/results/     hasil terbit (allowlist DTO)
      admin/               users, monitoring
  components/
    ui/                    komponen Neumorphism UI (Base UI + Tailwind v4)
    app-sidebar.tsx        navigasi per peran
  lib/
    auth/                  konfigurasi NextAuth + guard
    ai/                    adapter LLM, prompt v1, test
    validations/           skema Zod asesmen
    grading.ts             hitung total
    prisma.ts              klien Prisma + TLS Supabase
    api-client.ts          fetch client + timeout
  hooks/, generated/       hook UI, Prisma Client hasil generate
.github/workflows/ci.yml   typecheck, lint, test, build, migrate deploy
docs-ai/                   brief, PRD, arsitektur, tugas, progress
```

## Menjalankan lokal

Prasyarat: Node.js 22+, pnpm 10, database PostgreSQL (Supabase atau lokal).

```bash
pnpm install
cp .env.example .env.local
# isi nilai di .env.local (jangan commit)
pnpm db:migrate      # prisma migrate dev
pnpm db:generate     # prisma generate
pnpm db:seed         # opsional: data demo
pnpm dev
```

Buka `http://localhost:3000`.

### Variabel environment

| Variabel | Kegunaan |
|---|---|
| `DATABASE_URL` | Connection string PostgreSQL (pooler) untuk runtime |
| `DIRECT_URL` | Koneksi langsung untuk migrasi Prisma |
| `SUPABASE_CA_B64` | Root CA Supabase, base64 satu baris (TLS serverless) |
| `NEXTAUTH_URL` | URL aplikasi untuk NextAuth |
| `NEXTAUTH_SECRET` | Secret sesi (≥32 karakter acak) |
| `LLM_PROVIDER` | Nama provider pada adapter (mis. `openai-compatible`, `gemini`) |
| `LLM_MODEL` | ID model yang dipakai |
| `LLM_API_KEY` | Kunci API LLM (hanya server) |
| `LLM_BASE_URL` | Base URL endpoint LLM |

Nilai rahasia tidak boleh di-commit. `.env.example` hanya berisi placeholder.

## Perintah

| Perintah | Fungsi |
|---|---|
| `pnpm dev` | Server pengembangan |
| `pnpm build` | Build produksi |
| `pnpm start` | Jalankan hasil build |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest (unit test) |
| `pnpm db:migrate` | `prisma migrate dev` |
| `pnpm db:generate` | `prisma generate` |
| `pnpm db:seed` | Seed data demo |

## Alur demo 3 menit

| Waktu | Aksi |
|---|---|
| 0:00–0:25 | Guru membuka kelas, asesmen, dan rubrik |
| 0:25–0:55 | Siswa mengisi dan mengumpulkan LJK |
| 0:55–1:55 | Guru membuka LJK, minta draf AI, koreksi nilai per soal |
| 1:55–2:30 | Sahkan LJK, lanjut siswa berikutnya, tampilkan rekap |
| 2:30–3:00 | Terbitkan hasil; buka nilai dan umpan balik di akun siswa |

Data demo sintetis (kode siswa seperti S001), bukan identitas nyata.

## Struktur data ringkas

| Model | Isi |
|---|---|
| `User` (`Role`: TEACHER/STUDENT/ADMIN) | Akun, `anonCode` untuk LLM, `isActive`, `identifier` (NIP/NIS) |
| `Class` / `ClassMembership` | Kelas + kode bergabung, keanggotaan siswa |
| `Assessment` | Judul, instruksi, status DRAFT/OPEN/CLOSED, `version` |
| `Question` | Soal, `referenceAnswer` (tidak pernah dikirim ke siswa), `maxScore` |
| `RubricCriterion` | Kode kriteria, deskripsi, rentang skor, level (JSON) |
| `Submission` / `Answer` | Satu LJK per siswa per asesmen; jawaban ber-`version` |
| `AIResult` | Payload saran AI, provider/model/promptVersion, `cacheKey`, status validasi |
| `GradeRevision` / `GradeItem` | Draf/Final, `totalScore`, item per kriteria dengan `source` MANUAL/AI |
| `Publication` | Menunjuk satu `GradeRevision` Final yang diterbitkan |
| `AuditEvent`, `IdempotencyKey` | Jejak perubahan dan proteksi klik ganda |

## Keamanan & privasi

- **Anonimisasi ke LLM:** hanya `User.anonCode` yang dikirim, bukan nama atau email.
- **Jawaban siswa = data, bukan instruksi:** prompt memisahkan konten jawaban dari instruksi sistem.
- **Tanpa log jawaban:** teks jawaban tidak ditulis ke log operasional.
- **DTO allowlist:** payload siswa dibatasi field hasil terbit; acuan, rubrik internal, dan draf AI tidak ikut.
- **Otorisasi server:** setiap route memeriksa sesi, peran, dan kepemilikan; guru tidak bisa mengakses kelas guru lain; siswa lain mendapat 404.
- **TLS DB:** verifikasi penuh memakai root CA Supabase, bukan menonaktifkan verifikasi.

## Deployment

Vercel (Next.js) + Supabase (PostgreSQL).

1. Import repo di Vercel; set semua variabel env produksi (tanpa `sslmode` di URI, `SUPABASE_CA_B64` wajib).
2. Jalankan `pnpm prisma migrate deploy` (CI melakukannya otomatis saat push ke `main` dengan secret `DIRECT_URL`).
3. Smoke test: login guru dan siswa, alur nilai → sahkan → terbit → hasil siswa.

## Keterbatasan & roadmap

- Endpoint AI **belum diuji dengan LLM asli** (API key kosong); validasi diuji unit test.
- Job-lock "satu job AI per LJK" masih per-proses, bukan advisory lock DB.
- `GradeRevision.totalScore` tidak nullable, sehingga draf parsial tampil sebagai jumlah parsial.
- Ekspor CSV untuk soal dengan lebih dari satu kriteria baru mengekspor satu nilai.
- Belum ada hasil uji pilot; klaim penghematan waktu/akurasi AI masih hipotesis.
- Tanpa OCR dan tanpa fine-tuning; antarmuka bahasa Indonesia saja.
- CI/CD: GitHub Actions menjalankan typecheck, lint, test, build, dan migrasi.
- Belum ada tag rilis `submission-24h`, video demo, maupun pitch deck.

## Tim Kopsudomar

| Nama | Peran |
|---|---|
| Jauza Aida A. | Ketua, UI/UX (UPN "Veteran" Jawa Timur) |
| Achmad Lutfi Madhani | Full-stack (UTM) |
| Abdul Rohman Maulidhi | Full-stack (Unesa) |

Lisensi: lihat `LICENSE`.

## AI Use and Third-Party Declaration

- **Peran AI di produk:** menyiapkan saran skor, alasan, kutipan, dan umpan balik per kriteria. Guru menetapkan, mengubah, mengesahkan, dan menerbitkan nilai. AI tidak pernah menulis nilai final.
- **Provider & model LLM:** dikonfigurasi lewat `LLM_PROVIDER`, `LLM_MODEL`, `LLM_BASE_URL`. Model yang benar-benar dipakai pada demo: `<isi-provider-dan-versi-model>` (belum diverifikasi dengan API key asli).
- **Bantuan AI dalam pengembangan:** agen coding (OpenCode) dipakai untuk scaffolding, refactor, dan penulisan test; keputusan produk, desain, dan verifikasi akhir dilakukan tim.
- **Pustaka & lisensi:** Next.js, React, Tailwind CSS, shadcn/ui + Base UI, Radix UI, TanStack Query/Table, NextAuth.js, Prisma, Zod, bcryptjs, Vitest, lucide-react, sonner, Pretendard (font).
- **Layanan pihak ketiga:** penyedia LLM API, Vercel, Supabase.
- **Data:** seluruh data demo sintetis; identitas diganti kode anonim sebelum dikirim ke LLM.
