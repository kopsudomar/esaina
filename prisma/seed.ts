import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";
import { cacheKey, PROMPT_VERSION } from "../src/lib/ai/prompt";
import type { LlmQuestion } from "../src/lib/ai/adapter";

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEMO_PASSWORD = "demo1234";
const MAX_ANSWER = 5000;

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const hoursAgo = (n: number) => new Date(Date.now() - n * 60 * 60 * 1000);

// ---------------------------------------------------------------------------
// Konten demo (dipakai untuk seed dan untuk self-check sebelum insert)
// ---------------------------------------------------------------------------

type CriterionSpec = {
  code: string;
  description: string;
  minScore: number;
  maxScore: number;
  levels: Record<string, string>;
};

type QuestionSpec = {
  order: number;
  text: string;
  referenceAnswer: string;
  maxScore: number;
  criteria: CriterionSpec[];
};

const UTS_INSTRUCTION =
  "Pilih posisi yang jelas, kembangkan minimal dua argumen disertai contoh, lalu tutup dengan simpulan. Gunakan bahasa Indonesia baku. Setiap jawaban maksimal 5.000 karakter.";

const UTS_QUESTIONS: QuestionSpec[] = [
  {
    order: 1,
    text: "Banyak sekolah membatasi penggunaan telepon genggam selama jam pelajaran. Setujukah kamu dengan kebijakan tersebut? Tuliskan teks argumentasi yang memuat tesis, minimal dua argumen disertai contoh atau bukti, dan simpulan.",
    referenceAnswer:
      "Tesis harus menyatakan posisi (dibatasi, bukan dilarang sepenuhnya), dua sampai tiga argumen tentang gangguan konsentrasi, risiko sosial, dan kedisiplinan, dilengkapi contoh konkret, lalu simpulan yang menegaskan jalan tengah.",
    maxScore: 12,
    criteria: [
      {
        code: "K1",
        description: "Ketepatan isi dan kejelasan tesis",
        minScore: 0,
        maxScore: 4,
        levels: {
          "1": "Tidak ada tesis; isi tidak menjawab soal.",
          "2": "Tesis kabur atau berubah arah; argumen sebagian tidak mendukung.",
          "3": "Tesis jelas; satu argumen agak melebar tetapi masih terkait.",
          "4": "Tesis tegas dan posisi jelas; seluruh argumen relevan dengan tesis.",
        },
      },
      {
        code: "K2",
        description: "Kekuatan bukti dan contoh",
        minScore: 0,
        maxScore: 4,
        levels: {
          "1": "Tidak ada bukti atau contoh.",
          "2": "Bukti lemah, berupa pengalaman pribadi tanpa rincian, atau hanya pengulangan klaim.",
          "3": "Bukti ada dan relevan, tetapi sebagian masih umum.",
          "4": "Setiap argumen didukung bukti konkret, spesifik, dan relevan.",
        },
      },
      {
        code: "K3",
        description: "Struktur dan kejelasan bahasa",
        minScore: 0,
        maxScore: 4,
        levels: {
          "1": "Tidak berstruktur; sukar dipahami.",
          "2": "Struktur longgar, simpulan tidak menyimpulkan; kesalahan bahasa mengganggu.",
          "3": "Struktur terbaca, ada simpulan; beberapa kalimat kurang efektif.",
          "4": "Struktur runtut (pembuka–isi–simpulan), kalimat efektif, kohesi baik.",
        },
      },
    ],
  },
  {
    order: 2,
    text: "Remaja menghabiskan sebagian besar waktunya di media sosial. Jelaskan apa yang dimaksud etika bermedia sosial dan mengapa hal itu penting bagi remaja. Sertakan satu contoh kasus dan simpulan.",
    referenceAnswer:
      "Etika bermedia sosial adalah norma berinteraksi di platform digital (menghormati privasi, memeriksa kebenaran informasi, menghindari ujaran kebencian); penting karena jejak digital bertahan lama; disertai satu contoh kasus konkret dan simpulan.",
    maxScore: 8,
    criteria: [
      {
        code: "E1",
        description: "Ketepatan penjelasan etika bermedia sosial",
        minScore: 0,
        maxScore: 4,
        levels: {
          "1": "Tidak menjelaskan etika bermedia sosial.",
          "2": "Penjelasan sangat umum dan tidak tepat.",
          "3": "Penjelasan tepat tetapi belum lengkap.",
          "4": "Penjelasan tepat, lengkap, dan relevan dengan remaja.",
        },
      },
      {
        code: "E2",
        description: "Contoh kasus dan kejelasan bahasa",
        minScore: 0,
        maxScore: 4,
        levels: {
          "1": "Tidak ada contoh; bahasa sukar dipahami.",
          "2": "Contoh tidak konkret; banyak kesalahan bahasa.",
          "3": "Contoh ada tetapi kurang rinci; bahasa cukup jelas.",
          "4": "Contoh konkret dan relevan; bahasa jelas dan runtut.",
        },
      },
    ],
  },
];

const EKSPOSISI_QUESTIONS: QuestionSpec[] = [
  {
    order: 1,
    text: "Jelaskan peran literasi digital dalam belajar mandiri dan sertakan satu contoh penerapannya.",
    referenceAnswer:
      "Literasi digital membuat siswa mampu memilih sumber belajar yang sahih, mengatur waktu, dan memverifikasi informasi; contoh: memakai repositori jurnal atau video pembelajaran lalu mencatat sumbernya.",
    maxScore: 8,
    criteria: [
      {
        code: "L1",
        description: "Kejelasan tesis dan penjelasan",
        minScore: 0,
        maxScore: 4,
        levels: {
          "1": "Tidak ada tesis.",
          "2": "Tesis kabur, penjelasan minim.",
          "3": "Tesis jelas, penjelasan cukup.",
          "4": "Tesis tegas, penjelasan lengkap dan runtut.",
        },
      },
      {
        code: "L2",
        description: "Contoh penerapan dan bahasa",
        minScore: 0,
        maxScore: 4,
        levels: {
          "1": "Tidak ada contoh; bahasa sukar dipahami.",
          "2": "Contoh tidak konkret; banyak kesalahan bahasa.",
          "3": "Contoh ada tetapi kurang rinci; bahasa cukup jelas.",
          "4": "Contoh konkret dan relevan; bahasa jelas dan runtut.",
        },
      },
    ],
  },
];

const XIB_QUESTIONS: QuestionSpec[] = [
  {
    order: 1,
    text: "Tulis teks eksposisi tentang etika bermedia sosial bagi remaja. Sertakan penjelasan dan satu contoh.",
    referenceAnswer:
      "Etika bermedia sosial adalah norma berinteraksi di platform digital (privasi, verifikasi informasi, antikekerasan); penting karena jejak digital remaja bertahan lama; disertai satu contoh konkret.",
    maxScore: 8,
    criteria: [
      {
        code: "X1",
        description: "Isi dan ketepatan",
        minScore: 0,
        maxScore: 4,
        levels: {
          "1": "Isi tidak sesuai topik.",
          "2": "Isi sebagian kecil sesuai topik.",
          "3": "Isi sesuai topik, sebagian belum tepat.",
          "4": "Isi tepat, lengkap, dan sesuai topik.",
        },
      },
      {
        code: "X2",
        description: "Bahasa dan struktur",
        minScore: 0,
        maxScore: 4,
        levels: {
          "1": "Tidak berstruktur; sukar dipahami.",
          "2": "Struktur longgar; banyak kesalahan bahasa.",
          "3": "Struktur terbaca; beberapa kalimat kurang efektif.",
          "4": "Struktur runtut dan kalimat efektif.",
        },
      },
    ],
  },
];

const TEKS_A =
  "Penggunaan telepon genggam di sekolah sebaiknya dibatasi, bukan dilarang sepenuhnya. Aturan jelas memberi ruang bagi siswa memanfaatkan teknologi tanpa mengorbankan fokus.\n\nPertama, gawai memecah perhatian. Berdasarkan pengamatan di beberapa kelas, siswa yang membuka media sosial saat guru menjelaskan lebih sulit menangkap materi dan tertinggal pada bagian akhir pelajaran.\n\nKedua, pembatasan melindungi siswa dari risiko sosial. Perundungan daring dan perbandingan diri dengan unggahan orang lain dapat mengganggu kesehatan mental remaja. Sekolah perlu hadir sebagai ruang aman.\n\nKetiga, aturan yang jelas melatih kedisiplinan. Jika gawai hanya dipakai pada jam tertentu untuk pembelajaran, siswa belajar mengatur waktu dan membedakan kebutuhan dari keinginan.\n\nDengan demikian, pembatasan gawai adalah jalan tengah. Sekolah tidak perlu menolak teknologi, tetapi harus mengatur penggunaannya agar tujuan pendidikan tetap menjadi prioritas.";

const TEKS_B =
  "Menurut saya, penggunaan telepon genggam di sekolah perlu dibatasi. Banyak siswa tidak fokus karena terlalu sering bermain gawai saat pelajaran.\n\nArgumen pertama, gawai mengganggu konsentrasi. Teman-teman saya sering membuka chat ketika guru menjelaskan, sehingga mereka tidak tahu tugas yang diberikan.\n\nArgumen kedua, gawai membuat siswa malas berinteraksi. Mereka lebih suka berbicara lewat pesan daripada mengobrol langsung saat istirahat. Padahal, interaksi langsung penting untuk membangun pertemanan.\n\nNamun, saya juga setuju bahwa gawai berguna untuk mencari materi. Jadi, sekolah sebaiknya membuat aturan yang jelas tentang kapan gawai boleh digunakan.\n\nKesimpulannya, pembatasan gawai di sekolah penting agar siswa lebih fokus belajar dan tidak lupa bersosialisasi.";

const TEKS_C =
  "Gawai di sekolah menurut saya boleh saja dipakai. Teknologi sekarang sudah canggih, jadi siswa perlu belajar menggunakannya.\n\nAda beberapa alasan. Pertama, gawai bisa dipakai untuk mencari informasi di internet. Kedua, siswa bisa mengerjakan tugas lebih cepat. Namun, kadang siswa juga bermain game saat pelajaran.\n\nMenurut saya, yang penting adalah siswanya sendiri. Kalau siswa rajin, gawai tidak akan mengganggu. Kalau siswa malas, pasti akan mencari kesempatan untuk bermain.\n\nJadi, saya rasa tidak perlu ada aturan yang terlalu ketat.";

const TEKS_QA =
  "Etika bermedia sosial adalah seperangkat norma dalam berinteraksi di platform digital, seperti menghormati privasi, memeriksa kebenaran informasi sebelum membagikannya, dan menghindari ujaran kebencian. Etika ini penting bagi remaja karena jejak digital bertahan lama dan dapat memengaruhi masa depan. Contohnya, seorang siswa yang menyebarkan foto temannya tanpa izin dapat membuat korban mengalami tekanan psikologis dan berurusan dengan pihak sekolah. Karena itu, remaja perlu membiasakan diri berpikir sebelum mengunggah atau membagikan sesuatu.";

const TEKS_QB =
  "Etika bermedia sosial itu aturan sopan santun saat memakai media sosial. Kita harus sopan dan tidak menyinggung orang lain. Etika penting supaya remaja tidak terkena masalah. Contohnya, teman saya pernah berkomentar kasar dan akhirnya dimarahi guru. Jadi kita harus hati-hati dalam bermedia sosial.";

const TEKS_QC =
  "Media sosial sekarang banyak dipakai remaja. Etika itu penting supaya tidak ada masalah. Banyak orang berkelahi karena media sosial. Jadi kita harus pakai media sosial dengan baik.";

const TEKS_A_AWAL = "Penggunaan telepon genggam di sekolah sebaiknya dibatasi, bukan dilarang sepenuhnya.";

// Jawaban hampir menyentuh batas 5.000 karakter untuk menguji penghitung karakter.
const TEKS_PANJANG = (() => {
  const kalimat =
    "Pembatasan telepon genggam di sekolah perlu dijalankan dengan aturan yang jelas, konsisten, dan disosialisasikan kepada siswa serta orang tua agar tidak menimbulkan kebingungan.";
  let text = "";
  while (text.length + kalimat.length + 2 <= 4800) text += (text ? "\n\n" : "") + kalimat;
  return text;
})();

const TEKS_SINGKAT_Q2 = "Etika media sosial penting agar remaja tidak menyakiti orang lain.";

type SubmissionSpec = {
  studentKey: string;
  status: "IN_PROGRESS" | "SUBMITTED";
  version: number;
  daysAgo: number | null;
  answers: Record<number, string>;
};

const UTS_SUBMISSIONS: SubmissionSpec[] = [
  { studentKey: "s001", status: "SUBMITTED", version: 1, daysAgo: 2, answers: { 1: TEKS_A, 2: TEKS_QA } },
  { studentKey: "s002", status: "SUBMITTED", version: 1, daysAgo: 1, answers: { 1: TEKS_B, 2: TEKS_QB } },
  { studentKey: "s003", status: "SUBMITTED", version: 1, daysAgo: null, answers: { 1: TEKS_C, 2: TEKS_QC } },
  { studentKey: "s004", status: "SUBMITTED", version: 1, daysAgo: 1, answers: { 1: TEKS_A, 2: TEKS_QA } },
  { studentKey: "s005", status: "SUBMITTED", version: 1, daysAgo: 1, answers: { 1: "", 2: "" } },
  { studentKey: "s006", status: "SUBMITTED", version: 1, daysAgo: 1, answers: { 1: TEKS_PANJANG, 2: TEKS_SINGKAT_Q2 } },
  { studentKey: "s007", status: "IN_PROGRESS", version: 2, daysAgo: null, answers: { 1: TEKS_A_AWAL } },
  { studentKey: "s008", status: "IN_PROGRESS", version: 1, daysAgo: null, answers: {} },
];

const XIB_SUBMISSIONS: SubmissionSpec[] = [
  { studentKey: "s011", status: "SUBMITTED", version: 1, daysAgo: 3, answers: { 1: TEKS_QB } },
  { studentKey: "s012", status: "SUBMITTED", version: 1, daysAgo: 2, answers: { 1: TEKS_QC } },
  { studentKey: "s013", status: "IN_PROGRESS", version: 1, daysAgo: null, answers: { 1: TEKS_A_AWAL } },
];

const XIIA_STUDENT_KEYS = ["s001", "s002", "s003", "s004", "s005", "s006", "s007", "s008", "s009", "s010"];
const XIB_STUDENT_KEYS = ["s011", "s012", "s013"];

// Jawaban s003 disubmit 6 jam lalu; ditandai lewat hari pecahan.
const S003_SUBMITTED_AT = hoursAgo(6);

type GradeItemSpec = { order: number; code: string; score: number; feedback: string };

const S001_GRADE_ITEMS: GradeItemSpec[] = [
  { order: 1, code: "K1", score: 4, feedback: "Tesis tegas dan seluruh argumen mendukung posisi." },
  { order: 1, code: "K2", score: 3, feedback: "Bukti konkret pada argumen pertama; argumen lain masih umum." },
  { order: 1, code: "K3", score: 4, feedback: "Alur pembuka–argumen–simpulan runtut." },
  { order: 2, code: "E1", score: 4, feedback: "Definisi etika dan alasan relevan bagi remaja." },
  { order: 2, code: "E2", score: 3, feedback: "Contoh kasus jelas, simpulan bisa lebih tegas." },
];

type AiItemSpec = GradeItemSpec & { evidence: string; rationale: string };

const S002_AI_ITEMS: AiItemSpec[] = [
  {
    order: 1,
    code: "K1",
    score: 3,
    evidence: "Menurut saya, penggunaan telepon genggam di sekolah perlu dibatasi.",
    rationale: "Posisi jelas namun paragraf penutup membuka isu baru tanpa diintegrasikan.",
    feedback: "Satukan posisi dengan pembahasan manfaat gawai.",
  },
  {
    order: 1,
    code: "K2",
    score: 2,
    evidence: "Teman-teman saya sering membuka chat ketika guru menjelaskan, sehingga mereka tidak tahu tugas yang diberikan.",
    rationale: "Bukti masih anekdot tanpa rincian atau sumber.",
    feedback: "Tambahkan data atau contoh yang lebih spesifik.",
  },
  {
    order: 1,
    code: "K3",
    score: 3,
    evidence: "Kesimpulannya, pembatasan gawai di sekolah penting agar siswa lebih fokus belajar dan tidak lupa bersosialisasi.",
    rationale: "Struktur terbaca dan ada simpulan.",
    feedback: "Sintesiskan kedua argumen pada simpulan.",
  },
  {
    order: 2,
    code: "E1",
    score: 2,
    evidence: "Etika bermedia sosial itu aturan sopan santun saat memakai media sosial.",
    rationale: "Definisi sangat umum dan belum menyebut norma spesifik.",
    feedback: "Sebutkan norma seperti privasi dan verifikasi informasi.",
  },
  {
    order: 2,
    code: "E2",
    score: 2,
    evidence: "Contohnya, teman saya pernah berkomentar kasar dan akhirnya dimarahi guru.",
    rationale: "Contoh ada tetapi tanpa rincian dampak.",
    feedback: "Jelaskan dampak kasus terhadap korban.",
  },
];

const S002_ANSWERS: Record<number, string> = { 1: TEKS_B, 2: TEKS_QB };

// s003: AI menghasilkan evidence yang tidak ada di jawaban -> validationOk=false (jalur manual).
const S003_ANSWERS: Record<number, string> = { 1: TEKS_C, 2: TEKS_QC };

const S003_AI_ITEMS: AiItemSpec[] = [
  {
    order: 1,
    code: "K1",
    score: 2,
    evidence: "Gawai di sekolah menurut saya boleh saja dipakai.",
    rationale: "Posisi ada, tetapi bertentangan dengan paragraf yang mengakui gawai mengganggu.",
    feedback: "Tetapkan satu posisi dan dukung konsisten.",
  },
  {
    order: 1,
    code: "K2",
    score: 1,
    evidence: "Teknologi sekarang sudah canggih, jadi siswa perlu belajar menggunakannya.",
    rationale: "Tidak ada bukti atau contoh konkret.",
    feedback: "Tambahkan data atau pengalaman spesifik.",
  },
  {
    order: 1,
    code: "K3",
    score: 3,
    evidence: "Jadi, saya rasa tidak perlu ada aturan yang terlalu ketat.",
    rationale: "Struktur terbaca, simpulan kurang tegas.",
    feedback: "Perjelas simpulan dengan alasan utama.",
  },
  {
    order: 2,
    code: "E1",
    score: 2,
    evidence: "Etika itu penting supaya tidak ada masalah.",
    rationale: "Definisi etika bermedia sosial tidak dijelaskan.",
    feedback: "Sebutkan norma privasi dan verifikasi informasi.",
  },
  {
    order: 2,
    code: "E2",
    score: 2,
    evidence: "Data survei nasional tahun 2025 menunjukkan 78 persen remaja pernah menjadi korban perundungan daring.",
    rationale: "Model mengarang data yang tidak ada pada jawaban.",
    feedback: "Gunakan contoh yang benar-benar ditulis siswa.",
  },
];

// s004: AI lolos validasi, lalu diterapkan menjadi revisi DRAFT (belum disahkan).
const S004_ANSWERS: Record<number, string> = { 1: TEKS_A, 2: TEKS_QA };

const S004_AI_ITEMS: AiItemSpec[] = [
  {
    order: 1,
    code: "K1",
    score: 4,
    evidence: "Penggunaan telepon genggam di sekolah sebaiknya dibatasi, bukan dilarang sepenuhnya.",
    rationale: "Tesis tegas dan posisi jelas sejak pembuka.",
    feedback: "Pertahankan kejelasan tesis.",
  },
  {
    order: 1,
    code: "K2",
    score: 4,
    evidence: "Berdasarkan pengamatan di beberapa kelas, siswa yang membuka media sosial saat guru menjelaskan lebih sulit menangkap materi dan tertinggal pada bagian akhir pelajaran.",
    rationale: "Setiap argumen disertai bukti yang relevan.",
    feedback: "Tambahkan sumber data bila tersedia.",
  },
  {
    order: 1,
    code: "K3",
    score: 4,
    evidence: "Dengan demikian, pembatasan gawai adalah jalan tengah.",
    rationale: "Struktur runtut dari pembuka hingga simpulan.",
    feedback: "Alur sudah baik.",
  },
  {
    order: 2,
    code: "E1",
    score: 4,
    evidence: "Etika bermedia sosial adalah seperangkat norma dalam berinteraksi di platform digital, seperti menghormati privasi, memeriksa kebenaran informasi sebelum membagikannya, dan menghindari ujaran kebencian.",
    rationale: "Definisi lengkap dan menyebut norma spesifik.",
    feedback: "Definisi sudah tepat.",
  },
  {
    order: 2,
    code: "E2",
    score: 3,
    evidence: "Contohnya, seorang siswa yang menyebarkan foto temannya tanpa izin dapat membuat korban mengalami tekanan psikologis dan berurusan dengan pihak sekolah.",
    rationale: "Contoh konkret, dampak dijelaskan; simpulan bisa lebih tegas.",
    feedback: "Tegaskan simpulan pada akhir paragraf.",
  },
];

const S011_GRADE_ITEMS: GradeItemSpec[] = [
  { order: 1, code: "X1", score: 3, feedback: "Isi sesuai topik, definisi etika masih umum." },
  { order: 1, code: "X2", score: 3, feedback: "Struktur terbaca; beberapa kalimat perlu diperbaiki." },
];

type AiResultSpec = {
  id: string;
  studentKey: string;
  assessmentKey: "uts" | "xib";
  answers: Record<number, string>;
  items: AiItemSpec[];
  validationOk: boolean;
  validationMsg: string | null;
  tokenUsed: number;
  hoursAgo: number;
};

const AI_RESULTS: AiResultSpec[] = [
  {
    id: "seed-ai-s002",
    assessmentKey: "uts",
    studentKey: "s002",
    answers: S002_ANSWERS,
    items: S002_AI_ITEMS,
    validationOk: true,
    validationMsg: null,
    tokenUsed: 912,
    hoursAgo: 3,
  },
  {
    id: "seed-ai-s003",
    assessmentKey: "uts",
    studentKey: "s003",
    answers: S003_ANSWERS,
    items: S003_AI_ITEMS,
    validationOk: false,
    validationMsg: "Field evidence bukan kutipan persis dari jawaban untuk E2.",
    tokenUsed: 1043,
    hoursAgo: 6,
  },
  {
    id: "seed-ai-s004",
    assessmentKey: "uts",
    studentKey: "s004",
    answers: S004_ANSWERS,
    items: S004_AI_ITEMS,
    validationOk: true,
    validationMsg: null,
    tokenUsed: 887,
    hoursAgo: 2,
  },
];

type RevisionSpec = {
  id: string;
  studentKey: string;
  assessmentKey: "uts" | "xib";
  authorKey: "guru" | "guru2";
  approvedByKey: "guru" | "guru2" | null;
  status: "DRAFT" | "FINAL";
  version: number;
  source: "MANUAL" | "AI";
  aiResultId: string | null;
  totalScore: number;
  items: GradeItemSpec[];
  approvedHoursAgo: number | null;
};

const totalOf = (items: GradeItemSpec[]) => items.reduce((sum, i) => sum + i.score, 0);

const REVISIONS: RevisionSpec[] = [
  {
    id: "seed-grade-s001",
    studentKey: "s001",
    assessmentKey: "uts",
    authorKey: "guru",
    approvedByKey: "guru",
    status: "FINAL",
    version: 1,
    source: "MANUAL",
    aiResultId: null,
    totalScore: 18,
    items: S001_GRADE_ITEMS,
    approvedHoursAgo: 24,
  },
  {
    id: "seed-grade-s004-draft",
    studentKey: "s004",
    assessmentKey: "uts",
    authorKey: "guru",
    approvedByKey: null,
    status: "DRAFT",
    version: 1,
    source: "AI",
    aiResultId: "seed-ai-s004",
    totalScore: 19,
    items: S004_AI_ITEMS.map(({ order, code, score, feedback }) => ({ order, code, score, feedback })),
    approvedHoursAgo: null,
  },
  {
    id: "seed-grade-s011",
    studentKey: "s011",
    assessmentKey: "xib",
    authorKey: "guru2",
    approvedByKey: "guru2",
    status: "FINAL",
    version: 1,
    source: "MANUAL",
    aiResultId: null,
    totalScore: 6,
    items: S011_GRADE_ITEMS,
    approvedHoursAgo: 12,
  },
];

type PublicationSpec = {
  id: string;
  revisionId: string;
  assessmentKey: "uts" | "xib";
  publishedByKey: "guru" | "guru2";
  hoursAgo: number;
};

const PUBLICATIONS: PublicationSpec[] = [
  { id: "seed-pub-s001", revisionId: "seed-grade-s001", assessmentKey: "uts", publishedByKey: "guru", hoursAgo: 20 },
  { id: "seed-pub-s011", revisionId: "seed-grade-s011", assessmentKey: "xib", publishedByKey: "guru2", hoursAgo: 10 },
];

type AuditEventSpec = {
  id: string;
  actorKey: string;
  action: "SUBMIT" | "APPLY_AI" | "CHANGE_GRADE" | "APPROVE" | "PUBLISH" | "DELETE";
  entityType: string;
  entityId: string;
  versionBefore: number | null;
  versionAfter: number | null;
  hoursAgo: number;
};

const AUDIT_EVENTS: AuditEventSpec[] = [
  {
    id: "seed-audit-1",
    actorKey: "s001",
    action: "SUBMIT",
    entityType: "Submission",
    entityId: "sub:s001",
    versionBefore: null,
    versionAfter: 1,
    hoursAgo: 48,
  },
  {
    id: "seed-audit-2",
    actorKey: "guru",
    action: "APPROVE",
    entityType: "GradeRevision",
    entityId: "seed-grade-s001",
    versionBefore: 1,
    versionAfter: 1,
    hoursAgo: 24,
  },
  {
    id: "seed-audit-3",
    actorKey: "guru",
    action: "PUBLISH",
    entityType: "Publication",
    entityId: "pub:seed-pub-s001",
    versionBefore: null,
    versionAfter: null,
    hoursAgo: 20,
  },
  {
    id: "seed-audit-4",
    actorKey: "guru",
    action: "APPLY_AI",
    entityType: "GradeRevision",
    entityId: "seed-grade-s004-draft",
    versionBefore: null,
    versionAfter: 1,
    hoursAgo: 2,
  },
  {
    id: "seed-audit-5",
    actorKey: "guru",
    action: "CHANGE_GRADE",
    entityType: "GradeRevision",
    entityId: "seed-grade-s001",
    versionBefore: 1,
    versionAfter: 2,
    hoursAgo: 26,
  },
  {
    id: "seed-audit-6",
    actorKey: "s011",
    action: "SUBMIT",
    entityType: "Submission",
    entityId: "sub:s011",
    versionBefore: null,
    versionAfter: 1,
    hoursAgo: 72,
  },
  {
    id: "seed-audit-7",
    actorKey: "guru2",
    action: "APPROVE",
    entityType: "GradeRevision",
    entityId: "seed-grade-s011",
    versionBefore: null,
    versionAfter: 1,
    hoursAgo: 12,
  },
  {
    id: "seed-audit-8",
    actorKey: "guru2",
    action: "PUBLISH",
    entityType: "Publication",
    entityId: "pub:seed-pub-s011",
    versionBefore: null,
    versionAfter: null,
    hoursAgo: 10,
  },
  {
    id: "seed-audit-9",
    actorKey: "guru",
    action: "DELETE",
    entityType: "Submission",
    entityId: "seed-sub-legacy-s999",
    versionBefore: 1,
    versionAfter: null,
    hoursAgo: 96,
  },
];

const normalize = (s: string) => s.trim().replace(/\s+/g, " ");

function findCriterion(questions: QuestionSpec[], order: number, code: string): CriterionSpec {
  const question = questions.find((q) => q.order === order);
  const criterion = question?.criteria.find((c) => c.code === code);
  if (!criterion) throw new Error(`Self-check: kriteria ${order}/${code} tidak ditemukan di data demo.`);
  return criterion;
}

const ASSESSMENT_QUESTIONS: Record<"uts" | "xib", QuestionSpec[]> = {
  uts: UTS_QUESTIONS,
  xib: XIB_QUESTIONS,
};

function verifySeedData() {
  const submissions = [
    ...UTS_SUBMISSIONS.map((s) => ({ ...s, assessmentKey: "uts" as const })),
    ...XIB_SUBMISSIONS.map((s) => ({ ...s, assessmentKey: "xib" as const })),
  ];

  for (const sub of submissions) {
    for (const answer of Object.values(sub.answers)) {
      assert.ok(
        answer.length <= MAX_ANSWER,
        `Self-check: jawaban ${sub.studentKey} ${answer.length} karakter, melebihi batas ${MAX_ANSWER}.`,
      );
    }
  }
  assert.equal(TEKS_PANJANG.length > 4000 && TEKS_PANJANG.length <= MAX_ANSWER, true, "Self-check: jawaban panjang harus 4.000–5.000 karakter.");

  // tiap AIResult: satu item per (soal, kriteria), skor integer dalam rentang, evidence kutipan persis.
  for (const ai of AI_RESULTS) {
    const questions = ASSESSMENT_QUESTIONS[ai.assessmentKey];
    const expectedPairs = questions.flatMap((q) => q.criteria.map((c) => `${q.order}:${c.code}`));
    const seen = new Set<string>();
    let violations = 0;
    for (const item of ai.items) {
      const key = `${item.order}:${item.code}`;
      assert.ok(expectedPairs.includes(key), `Self-check: ${ai.id} memuat kriteria asing ${key}.`);
      assert.ok(!seen.has(key), `Self-check: ${ai.id} memuat kriteria duplikat ${key}.`);
      seen.add(key);
      const criterion = findCriterion(questions, item.order, item.code);
      assert.ok(
        Number.isInteger(item.score) && item.score >= criterion.minScore && item.score <= criterion.maxScore,
        `Self-check: skor AI ${item.score} di luar ${criterion.minScore}–${criterion.maxScore} untuk ${key}.`,
      );
      const answer = ai.answers[item.order];
      assert.ok(answer !== undefined, `Self-check: ${ai.id} tidak punya jawaban soal ${item.order}.`);
      const isQuote = normalize(answer).includes(normalize(item.evidence));
      if (ai.validationOk) assert.ok(isQuote, `Self-check: evidence ${ai.id} bukan kutipan persis jawaban untuk ${key}.`);
      else if (!isQuote) violations += 1;
    }
    assert.equal(seen.size, expectedPairs.length, `Self-check: payload ${ai.id} tidak lengkap (${seen.size}/${expectedPairs.length}).`);
    if (ai.validationOk) {
      assert.equal(ai.validationMsg, null, `Self-check: ${ai.id} valid tetapi validationMsg terisi.`);
    } else {
      assert.ok(ai.validationMsg, `Self-check: ${ai.id} gagal validasi tanpa pesan.`);
      assert.ok(violations > 0, `Self-check: ${ai.id} ditandai gagal validasi tetapi semua evidence valid.`);
    }
  }

  // setiap revisi: totalScore == jumlah item non-null, dan tiap item dalam rentang kriteria.
  for (const rev of REVISIONS) {
    const questions = ASSESSMENT_QUESTIONS[rev.assessmentKey];
    const seen = new Set<string>();
    for (const item of rev.items) {
      const key = `${item.order}:${item.code}`;
      assert.ok(!seen.has(key), `Self-check: ${rev.id} memuat item duplikat ${key}.`);
      seen.add(key);
      const criterion = findCriterion(questions, item.order, item.code);
      assert.ok(
        Number.isInteger(item.score) && item.score >= criterion.minScore && item.score <= criterion.maxScore,
        `Self-check: skor ${item.score} di luar ${criterion.minScore}–${criterion.maxScore} untuk ${rev.id} ${key}.`,
      );
    }
    const total = totalOf(rev.items);
    assert.equal(rev.totalScore, total, `Self-check: totalScore ${rev.id} ${rev.totalScore} != jumlah item ${total}.`);
    assert.equal(rev.items.length, questions.reduce((n, q) => n + q.criteria.length, 0), `Self-check: ${rev.id} tidak menilai semua kriteria.`);
    assert.equal(rev.status === "FINAL" ? rev.approvedByKey !== null : rev.approvedByKey === null, true, `Self-check: status/approvedBy ${rev.id} tidak konsisten.`);
    if (rev.source === "MANUAL") assert.equal(rev.aiResultId, null, `Self-check: revisi MANUAL ${rev.id} tidak boleh menunjuk AIResult.`);
    else assert.ok(rev.aiResultId !== null, `Self-check: revisi AI ${rev.id} harus menunjuk AIResult.`);
  }

  // publikasi hanya untuk revisi FINAL yang sudah disahkan.
  for (const pub of PUBLICATIONS) {
    const rev = REVISIONS.find((r) => r.id === pub.revisionId);
    assert.ok(rev, `Self-check: publikasi ${pub.id} menunjuk revisi tak dikenal.`);
    assert.equal(rev.status, "FINAL", `Self-check: publikasi ${pub.id} bukan revisi FINAL.`);
    assert.ok(rev.approvedByKey !== null, `Self-check: publikasi ${pub.id} tanpa approvedBy.`);
    assert.equal(rev.assessmentKey, pub.assessmentKey, `Self-check: assessment publikasi ${pub.id} tidak cocok.`);
  }

  // idempotensi himpunan: tidak ada duplikat anggota kelas / submission / anonCode.
  assert.equal(new Set(XIIA_STUDENT_KEYS).size, XIIA_STUDENT_KEYS.length, "Self-check: anggota XII A duplikat.");
  assert.equal(new Set(XIB_STUDENT_KEYS).size, XIB_STUDENT_KEYS.length, "Self-check: anggota XI B duplikat.");
  assert.equal(new Set([...XIIA_STUDENT_KEYS, ...XIB_STUDENT_KEYS]).size, XIIA_STUDENT_KEYS.length + XIB_STUDENT_KEYS.length, "Self-check: siswa ada di dua kelas sekaligus.");
  const studentKeys = submissions.map((s) => `${s.assessmentKey}:${s.studentKey}`);
  assert.equal(new Set(studentKeys).size, studentKeys.length, "Self-check: submission duplikat per (asesmen, siswa).");
  assert.equal(new Set(REVISIONS.map((r) => r.id)).size, REVISIONS.length, "Self-check: id revisi duplikat.");
  assert.equal(new Set(PUBLICATIONS.map((p) => p.revisionId)).size, PUBLICATIONS.length, "Self-check: satu revisi terbit dua kali.");
  assert.equal(new Set(AUDIT_EVENTS.map((a) => a.id)).size, AUDIT_EVENTS.length, "Self-check: id audit duplikat.");
  assert.equal(new Set(AUDIT_EVENTS.map((a) => a.action)).size, 6, "Self-check: audit harus mencakup keenam action.");
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

type SeededCriterion = CriterionSpec & { id: string };
type SeededQuestion = {
  id: string;
  text: string;
  referenceAnswer: string;
  criteria: Map<string, SeededCriterion>;
};

type AssessmentSpec = {
  id: string;
  classId: string;
  title: string;
  instruction: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
  durationMinutes: number;
  openedAt: Date | null;
  closedAt: Date | null;
  questions: QuestionSpec[];
};

async function seedAssessment(spec: AssessmentSpec) {
  const assessment = await prisma.assessment.upsert({
    where: { id: spec.id },
    update: {
      classId: spec.classId,
      title: spec.title,
      instruction: spec.instruction,
      status: spec.status,
      durationMinutes: spec.durationMinutes,
      openedAt: spec.openedAt,
      closedAt: spec.closedAt,
    },
    create: {
      id: spec.id,
      classId: spec.classId,
      title: spec.title,
      instruction: spec.instruction,
      status: spec.status,
      durationMinutes: spec.durationMinutes,
      openedAt: spec.openedAt,
      closedAt: spec.closedAt,
    },
  });

  const questions = new Map<number, SeededQuestion>();
  for (const spec_ of spec.questions) {
    const question = await prisma.question.upsert({
      where: { assessmentId_order: { assessmentId: assessment.id, order: spec_.order } },
      update: { text: spec_.text, referenceAnswer: spec_.referenceAnswer, maxScore: spec_.maxScore },
      create: {
        assessmentId: assessment.id,
        order: spec_.order,
        text: spec_.text,
        referenceAnswer: spec_.referenceAnswer,
        maxScore: spec_.maxScore,
      },
    });

    const criteria = new Map<string, SeededCriterion>();
    for (const [index, c] of spec_.criteria.entries()) {
      const criterion = await prisma.rubricCriterion.upsert({
        where: { questionId_code: { questionId: question.id, code: c.code } },
        update: {
          description: c.description,
          minScore: c.minScore,
          maxScore: c.maxScore,
          levels: c.levels,
          order: index + 1,
        },
        create: {
          questionId: question.id,
          code: c.code,
          description: c.description,
          minScore: c.minScore,
          maxScore: c.maxScore,
          levels: c.levels,
          order: index + 1,
        },
      });
      criteria.set(c.code, { ...c, id: criterion.id });
    }
    questions.set(spec_.order, { id: question.id, text: spec_.text, referenceAnswer: spec_.referenceAnswer, criteria });
  }

  return { id: assessment.id, questions };
}

type SeededAssessment = Awaited<ReturnType<typeof seedAssessment>>;

async function seedSubmission(
  assessmentId: string,
  questions: SeededAssessment["questions"],
  spec: SubmissionSpec,
  studentId: string,
  submittedAt: Date | null,
) {
  const submission = await prisma.submission.upsert({
    where: { assessmentId_studentId: { assessmentId, studentId } },
    update: { status: spec.status, version: spec.version, submittedAt },
    create: { assessmentId, studentId, status: spec.status, version: spec.version, submittedAt },
  });

  const seededQuestionIds: string[] = [];
  for (const [orderKey, content] of Object.entries(spec.answers)) {
    const question = questions.get(Number(orderKey));
    if (!question) throw new Error(`Soal order ${orderKey} tidak ada pada assessment ${assessmentId}.`);
    seededQuestionIds.push(question.id);
    await prisma.answer.upsert({
      where: { submissionId_questionId: { submissionId: submission.id, questionId: question.id } },
      update: { content },
      create: { submissionId: submission.id, questionId: question.id, content },
    });
  }
  // Jawaban sisa dari seed sebelumnya dibuang agar state (mis. s008 tanpa jawaban) konsisten.
  await prisma.answer.deleteMany({
    where: { submissionId: submission.id, questionId: { notIn: seededQuestionIds } },
  });

  return submission;
}

function questionOf(assessment: SeededAssessment, order: number): SeededQuestion {
  const question = assessment.questions.get(order);
  if (!question) throw new Error(`Soal order ${order} tidak ada pada ${assessment.id}.`);
  return question;
}

function criterionOf(assessment: SeededAssessment, order: number, code: string): SeededCriterion {
  const criterion = questionOf(assessment, order).criteria.get(code);
  if (!criterion) throw new Error(`Kriteria ${code} tidak ada pada soal order ${order}.`);
  return criterion;
}

async function seedRevision(
  spec: RevisionSpec,
  submissionId: string,
  assessment: SeededAssessment,
  users: Record<string, { id: string }>,
) {
  const authorId = users[spec.authorKey].id;
  const approvedById = spec.approvedByKey ? users[spec.approvedByKey].id : null;
  const approvedAt = spec.approvedHoursAgo === null ? null : hoursAgo(spec.approvedHoursAgo);

  await prisma.gradeRevision.upsert({
    where: { id: spec.id },
    update: {
      submissionId,
      authorId,
      approvedById,
      status: spec.status,
      version: spec.version,
      totalScore: spec.totalScore,
      approvedAt,
    },
    create: {
      id: spec.id,
      submissionId,
      authorId,
      approvedById,
      status: spec.status,
      version: spec.version,
      totalScore: spec.totalScore,
      approvedAt,
    },
  });

  const keptCriterionIds = spec.items.map((item) => criterionOf(assessment, item.order, item.code).id);
  for (const item of spec.items) {
    const questionId = questionOf(assessment, item.order).id;
    const criterionId = criterionOf(assessment, item.order, item.code).id;
    await prisma.gradeItem.upsert({
      where: { revisionId_questionId_criterionId: { revisionId: spec.id, questionId, criterionId } },
      update: { score: item.score, feedback: item.feedback, source: spec.source, aiResultId: spec.aiResultId },
      create: {
        revisionId: spec.id,
        questionId,
        criterionId,
        score: item.score,
        feedback: item.feedback,
        source: spec.source,
        aiResultId: spec.aiResultId,
      },
    });
  }
  // Item di luar matrix dibuang agar totalScore == jumlah skor tetap berlaku saat seed diulang.
  await prisma.gradeItem.deleteMany({ where: { revisionId: spec.id, criterionId: { notIn: keptCriterionIds } } });
}

async function main() {
  verifySeedData();

  // Konten seed lama diganti total (soal ke-2 tanpa kriteria membuat validasi AI gagal).
  await prisma.assessment.deleteMany({ where: { id: "seed-uts-ipa" } });

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const userSpecs = [
    { email: "guru@demo.sch.id", name: "Bu Dewi Lestari", role: "TEACHER", identifier: "NIP-001", anonCode: "T-DEMO" },
    { email: "guru2@demo.sch.id", name: "Pak Rudi Hartono", role: "TEACHER", identifier: "NIP-002", anonCode: "T-DEMO2" },
    { email: "admin@demo.sch.id", name: "Admin Sekolah", role: "ADMIN", identifier: "NIP-ADM", anonCode: "A-DEMO" },
    ...Array.from({ length: 14 }, (_, i) => {
      const code = `S${String(i + 1).padStart(3, "0")}`;
      return {
        email: `${code.toLowerCase()}@demo.sch.id`,
        name: `Siswa ${code}`,
        role: "STUDENT" as const,
        identifier: `NIS-${code}`,
        anonCode: code,
      };
    }),
  ] as const;

  const users: Record<string, { id: string }> = {};
  for (const spec of userSpecs) {
    const email = spec.email.toLowerCase();
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: spec.name,
        role: spec.role,
        identifier: spec.identifier,
        anonCode: spec.anonCode,
        passwordHash: hash,
      },
      create: {
        email,
        name: spec.name,
        role: spec.role,
        identifier: spec.identifier,
        anonCode: spec.anonCode,
        passwordHash: hash,
      },
    });
    users[spec.email.split("@")[0]] = user;
  }

  const guru = users["guru"];
  const guru2 = users["guru2"];
  const xiiA = await prisma.class.upsert({
    where: { joinCode: "XIIA01" },
    update: { name: "XII A", teacherId: guru.id },
    create: { name: "XII A", joinCode: "XIIA01", teacherId: guru.id },
  });
  const xiB = await prisma.class.upsert({
    where: { joinCode: "XIB02" },
    update: { name: "XI B", teacherId: guru2.id },
    create: { name: "XI B", joinCode: "XIB02", teacherId: guru2.id },
  });
  // Kelas kosong: untuk demo state kosong (belum ada anggota / belum ada asesmen).
  await prisma.class.upsert({
    where: { joinCode: "XIIC03" },
    update: { name: "XII C", teacherId: guru.id },
    create: { name: "XII C", joinCode: "XIIC03", teacherId: guru.id },
  });

  const memberships = [
    ...XIIA_STUDENT_KEYS.map((key) => ({ classId: xiiA.id, studentId: users[key].id })),
    ...XIB_STUDENT_KEYS.map((key) => ({ classId: xiB.id, studentId: users[key].id })),
  ];
  for (const m of memberships) {
    await prisma.classMembership.upsert({
      where: { classId_studentId: m },
      update: {},
      create: m,
    });
  }
  // Sisa seed lama (mis. s005 di XI B) dibersihkan per kelas agar matriks demo konsisten.
  for (const [classId, keys] of [[xiiA.id, XIIA_STUDENT_KEYS], [xiB.id, XIB_STUDENT_KEYS]] as const) {
    await prisma.classMembership.deleteMany({
      where: { classId, studentId: { notIn: keys.map((k) => users[k].id) } },
    });
  }

  const uts = await seedAssessment({
    id: "seed-uts-bindo",
    classId: xiiA.id,
    title: "Asesmen Tengah Semester — Teks Argumentasi",
    instruction: UTS_INSTRUCTION,
    status: "OPEN",
    durationMinutes: 90,
    openedAt: new Date(),
    closedAt: null,
    questions: UTS_QUESTIONS,
  });

  await seedAssessment({
    id: "seed-latihan-eksposisi",
    classId: xiiA.id,
    title: "Latihan — Teks Eksposisi",
    instruction:
      "Susun teks eksposisi tentang peran literasi digital dalam belajar mandiri. Struktur: tesis, penjelasan, contoh, simpulan.",
    status: "DRAFT",
    durationMinutes: 60,
    openedAt: null,
    closedAt: null,
    questions: EKSPOSISI_QUESTIONS,
  });

  const xiBEsai = await seedAssessment({
    id: "seed-xi-b-esai",
    classId: xiB.id,
    title: "Ulangan Harian — Teks Eksposisi (XI B)",
    instruction: "Tulis teks eksposisi tentang etika bermedia sosial bagi remaja.",
    status: "CLOSED",
    durationMinutes: 60,
    openedAt: daysAgo(7),
    closedAt: daysAgo(1),
    questions: XIB_QUESTIONS,
  });

  const assessmentByKey: Record<"uts" | "xib", SeededAssessment> = { uts, xib: xiBEsai };
  const studentById: Record<string, string> = Object.fromEntries(
    Object.entries(users).map(([key, user]) => [key, user.id]),
  );

  const submissions: Record<string, { id: string; version: number }> = {};
  for (const spec of UTS_SUBMISSIONS) {
    const submittedAt = spec.studentKey === "s003" ? S003_SUBMITTED_AT : spec.daysAgo === null ? null : daysAgo(spec.daysAgo);
    submissions[`sub:${spec.studentKey}`] = await seedSubmission(uts.id, uts.questions, spec, studentById[spec.studentKey], submittedAt);
  }
  for (const spec of XIB_SUBMISSIONS) {
    const submittedAt = spec.daysAgo === null ? null : daysAgo(spec.daysAgo);
    submissions[`sub:${spec.studentKey}`] = await seedSubmission(xiBEsai.id, xiBEsai.questions, spec, studentById[spec.studentKey], submittedAt);
  }

  for (const [assessment, keys] of [[uts, UTS_SUBMISSIONS], [xiBEsai, XIB_SUBMISSIONS]] as const) {
    await prisma.submission.deleteMany({
      where: { assessmentId: assessment.id, studentId: { notIn: keys.map((k) => studentById[k.studentKey]) } },
    });
  }

  const provider = process.env.LLM_PROVIDER ?? "openai-compatible";
  const model = process.env.LLM_MODEL ?? "";

  for (const ai of AI_RESULTS) {
    const assessment = assessmentByKey[ai.assessmentKey];
    const sub = submissions[`sub:${ai.studentKey}`];
    if (!sub) throw new Error(`AIResult ${ai.id}: submission ${ai.studentKey} tidak ada.`);

    const llmQuestions: LlmQuestion[] = [...assessment.questions.entries()].map(([order, question]) => ({
      id: question.id,
      text: question.text,
      referenceAnswer: question.referenceAnswer,
      criteria: [...question.criteria.values()].map((c) => ({
        id: c.id,
        code: c.code,
        description: c.description,
        minScore: c.minScore,
        maxScore: c.maxScore,
      })),
      answer: ai.answers[order] ?? "",
    }));

    const aiItems = ai.items.map((item) => ({
      questionId: questionOf(assessment, item.order).id,
      criterionId: criterionOf(assessment, item.order, item.code).id,
      score: item.score,
      evidence: item.evidence,
      rationale: item.rationale,
      feedback: item.feedback,
    }));

    const data = {
      submissionId: sub.id,
      requestedById: guru.id,
      provider,
      model,
      promptVersion: PROMPT_VERSION,
      cacheKey: cacheKey({ submissionId: sub.id, version: sub.version, questions: llmQuestions, provider, model }),
      sourceVersion: sub.version,
      payload: { items: aiItems },
      validationOk: ai.validationOk,
      validationMsg: ai.validationMsg,
      tokenUsed: ai.tokenUsed,
      attemptedAt: hoursAgo(ai.hoursAgo),
    };
    await prisma.aIResult.upsert({ where: { id: ai.id }, update: data, create: { id: ai.id, ...data } });
  }

  for (const rev of REVISIONS) {
    const sub = submissions[`sub:${rev.studentKey}`];
    if (!sub) throw new Error(`Revisi ${rev.id}: submission ${rev.studentKey} tidak ada.`);
    await seedRevision(rev, sub.id, assessmentByKey[rev.assessmentKey], users);
  }

  for (const pub of PUBLICATIONS) {
    const data = {
      assessmentId: assessmentByKey[pub.assessmentKey].id,
      publishedById: users[pub.publishedByKey].id,
      publishedAt: hoursAgo(pub.hoursAgo),
    };
    await prisma.publication.upsert({
      where: { revisionId: pub.revisionId },
      update: data,
      create: { id: pub.id, revisionId: pub.revisionId, ...data },
    });
  }

  const resolveEntityId = (entityId: string) => {
    if (entityId.startsWith("sub:")) return submissions[entityId]?.id ?? entityId;
    if (entityId.startsWith("pub:")) return entityId.slice(4);
    return entityId;
  };

  for (const spec of AUDIT_EVENTS) {
    const data = {
      actorId: users[spec.actorKey].id,
      action: spec.action,
      entityType: spec.entityType,
      entityId: resolveEntityId(spec.entityId),
      versionBefore: spec.versionBefore,
      versionAfter: spec.versionAfter,
      createdAt: hoursAgo(spec.hoursAgo),
    };
    await prisma.auditEvent.upsert({ where: { id: spec.id }, update: data, create: { id: spec.id, ...data } });
  }

  const idempotencyKeys = [
    { key: "seed-publish-s001", userId: guru.id, scope: "publish" },
    { key: "seed-approve-s001", userId: guru.id, scope: "approve" },
    { key: "seed-submit-s008", userId: users["s008"].id, scope: "submit" },
    { key: "seed-approve-s011", userId: guru2.id, scope: "approve" },
  ];
  for (const key of idempotencyKeys) {
    await prisma.idempotencyKey.upsert({ where: { key: key.key }, update: key, create: key });
  }

  console.log(`
Seed demo selesai.

Login: /login (password semua akun: ${DEMO_PASSWORD})
  Guru     guru@demo.sch.id   (Bu Dewi Lestari)
  Guru     guru2@demo.sch.id  (Pak Rudi Hartono)
  Admin    admin@demo.sch.id
  Siswa    s001@demo.sch.id .. s014@demo.sch.id

Kode join kelas: XII A = XIIA01, XI B = XIB02, XII C = XIIC03 (kosong)

Matriks demo — Asesmen Tengah Semester (OPEN, XII A, guru):
  s001  terbit          FINAL + publication (18), tampil di hasil siswa
  s002  saran AI siap   AIResult validationOk=true, belum ada revisi
  s003  AI gagal        AIResult validationOk=false (evidence tidak ditemukan) -> jalur manual
  s004  menunggu sahkan revisi DRAFT dari apply AI (19), belum terbit
  s005  jawaban kosong  nilai kosong != 0, belum dinilai
  s006  jawaban panjang ±4.800 karakter (uji penghitung karakter), belum dinilai
  s007  autosave        IN_PROGRESS, 1 jawaban tersimpan
  s008  kosong          IN_PROGRESS, belum ada jawaban
  s009  belum kumpul    anggota kelas tanpa submission (jangan ekspor 0)
  s010  belum kumpul    anggota kelas tanpa submission (jangan ekspor 0)

Matriks demo — Ulangan Harian Teks Eksposisi (CLOSED, XI B, guru2):
  s011  terbit          FINAL + publication (6)
  s012  belum dinilai    SUBMITTED tanpa revisi
  s013  autosave        IN_PROGRESS, 1 jawaban

State lain:
  s014  siswa tanpa kelas (dashboard kosong)
  XII C (XIIC03)         kelas kosong tanpa anggota
  Latihan — Teks Eksposisi (DRAFT, XII A): belum ada pengerjaan
  Audit: SUBMIT, APPLY_AI, CHANGE_GRADE, APPROVE, PUBLISH, DELETE
  Uji 403 lintas kelas: login guru2, buka LJK asesmen XII A (mis. s001) -> ditolak
`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
