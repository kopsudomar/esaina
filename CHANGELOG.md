# Changelog

Semua perubahan penting pada ESAINA. Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/); versi mengikuti [Semantic Versioning](https://semver.org/lang/id/).

## [0.1.0] - 2026-11-01 — `submission-24h`

Rilis pertama untuk penyerahan INCEPTION 2026. Alur penilaian esai berjalan ujung-ke-ujung: guru menyiapkan asesmen, siswa mengerjakan, AI menyiapkan draf saran per kriteria, guru mengesahkan, hasil diterbitkan.

### Ditambahkan

- **Autentikasi & peran** — NextAuth JWT dengan peran guru, siswa, admin; guard server pada setiap route (sesi, peran, kepemilikan kelas, keanggotaan kelas).
- **Kelas** — guru membuat/mengubah/menghapus kelas, mengelola anggota; siswa bergabung lewat kode kelas.
- **Asesmen** — soal, jawaban acuan, rubrik per kriteria dengan level skor, durasi pengerjaan, buka/tutup asesmen.
- **Pengerjaan siswa** — autosave 1 detik, batas 5.000 karakter per jawaban (UI dan server), kumpulkan dengan transaksi + idempotency key.
- **Penilaian guru** — daftar LJK, penilaian manual per kriteria, total dihitung server, `expected_version` untuk konkurensi.
- **Saran AI** — adapter LLM provider-agnostik, prompt dengan kode anonim, `temperature: 0`, timeout 30 detik, cache berbasis hash jawaban+rubrik+prompt+model+provider.
- **Validasi keluaran AI** — skema, tiap soal×kriteria tepat sekali, tanpa ID asing, skor dalam rentang rubrik, `evidence` harus kutipan persis; retry maksimal 1x, jalur manual tetap tersedia.
- **Pengesahan & penerbitan** — revisi draf → sahkan FINAL → terbitkan; versi terbit lama tetap tampil sampai revisi baru diterbitkan.
- **Hasil siswa** — hanya snapshot yang sudah diterbitkan, payload memakai allowlist; nilai kosong ≠ nol.
- **Rekap & ekspor CSV** — rekap penilaian per asesmen, ekspor nilai.
- **Panel admin** — manajemen pengguna, KPI, monitoring progres.
- **Audit trail** — `AuditEvent` untuk submit, apply AI, ubah nilai, sahkan, terbitkan, hapus.
- **Design system** — Neumorphism UI dengan token navy, font Pretendard Variable, mode terang dan gelap.
- **CI** — GitHub Actions: build, typecheck, lint, test pada setiap PR dan push ke `main`; `prisma migrate deploy` pada push ke `main`.

### Keamanan

- Jawaban siswa diperlakukan sebagai data, bukan instruksi; dikirim ke LLM dengan `anonCode`, bukan nama/email.
- Teks jawaban tidak ditulis ke log operasional.
- Payload siswa memakai allowlist field; jawaban acuan, rubrik internal, dan draf AI tidak pernah dikirim ke siswa.

### Diketahui belum

- AI belum diuji dengan penyedia LLM asli pada build terakhir (validasi lewat unit test).
- Job-lock "satu job AI per LJK" masih per-proses, belum memakai advisory lock DB.
- `totalScore` belum nullable sehingga draf parsial menyimpan jumlah parsial.
- Ekspor CSV untuk soal dengan lebih dari satu kriteria baru menampilkan satu nilai.
- Tanpa OCR — jawaban harus diketik.
- UI dan prompt baru tersedia dalam bahasa Indonesia.

[0.1.0]: https://github.com/kopsudomar/esaina/releases/tag/submission-24h
