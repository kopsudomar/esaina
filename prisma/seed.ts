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
  { studentKey: "s004", status: "IN_PROGRESS", version: 3, daysAgo: null, answers: { 1: TEKS_A_AWAL, 2: "" } },
];

const XIB_SUBMISSIONS: SubmissionSpec[] = [
  { studentKey: "s006", status: "SUBMITTED", version: 1, daysAgo: 2, answers: { 1: TEKS_QB } },
];

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

// ---------------------------------------------------------------------------
// Self-check data demo — gagal cepat sebelum menyentuh DB
// ---------------------------------------------------------------------------

const normalize = (s: string) => s.trim().replace(/\s+/g, " ");

function findCriterion(questions: QuestionSpec[], order: number, code: string): CriterionSpec {
  const question = questions.find((q) => q.order === order);
  const criterion = question?.criteria.find((c) => c.code === code);
  if (!criterion) throw new Error(`Self-check: kriteria ${order}/${code} tidak ditemukan di data demo.`);
  return criterion;
}

function verifySeedData() {
  const allAnswers: string[] = [
    ...UTS_SUBMISSIONS.flatMap((s) => Object.values(s.answers)),
    ...XIB_SUBMISSIONS.flatMap((s) => Object.values(s.answers)),
  ];

  for (const answer of allAnswers) {
    assert.ok(
      answer.length <= MAX_ANSWER,
      `Self-check: ada jawaban ${answer.length} karakter, melebihi batas ${MAX_ANSWER}.`,
    );
  }

  for (const item of S002_AI_ITEMS) {
    const answer = S002_ANSWERS[item.order];
    assert.ok(answer !== undefined, `Self-check: jawaban s002 untuk soal ${item.order} tidak ada.`);
    assert.ok(
      normalize(answer).includes(normalize(item.evidence)),
      `Self-check: evidence bukan kutipan persis jawaban untuk soal ${item.order}/${item.code}.`,
    );
    const criterion = findCriterion(UTS_QUESTIONS, item.order, item.code);
    assert.ok(
      Number.isInteger(item.score) && item.score >= criterion.minScore && item.score <= criterion.maxScore,
      `Self-check: skor AI ${item.score} di luar ${criterion.minScore}–${criterion.maxScore} untuk ${item.order}/${item.code}.`,
    );
  }

  // soal 1 punya 3 kriteria, soal 2 punya 2 kriteria
  const q1Codes = UTS_QUESTIONS.find((q) => q.order === 1)!.criteria.map((c) => c.code);
  const q2Codes = UTS_QUESTIONS.find((q) => q.order === 2)!.criteria.map((c) => c.code);
  const pairs = new Set(S002_AI_ITEMS.map((i) => `${i.order}:${i.code}`));
  assert.equal(S002_AI_ITEMS.length, 5, "Self-check: payload AI harus 5 item.");
  assert.equal(pairs.size, 5, "Self-check: payload AI memuat pasangan soal×kriteria duplikat.");
  assert.equal(
    S002_AI_ITEMS.filter((i) => i.order === 1 && q1Codes.includes(i.code)).length,
    q1Codes.length,
    "Self-check: payload AI tidak lengkap untuk soal 1.",
  );
  assert.equal(
    S002_AI_ITEMS.filter((i) => i.order === 2 && q2Codes.includes(i.code)).length,
    q2Codes.length,
    "Self-check: payload AI tidak lengkap untuk soal 2.",
  );

  assert.equal(S001_GRADE_ITEMS.length, 5, "Self-check: GradeItem s001 harus 5.");
  const s001Total = S001_GRADE_ITEMS.reduce((sum, i) => sum + i.score, 0);
  assert.equal(s001Total, 18, `Self-check: total skor s001 ${s001Total}, harus 18.`);
  for (const item of S001_GRADE_ITEMS) {
    const criterion = findCriterion(UTS_QUESTIONS, item.order, item.code);
    assert.ok(
      item.score >= criterion.minScore && item.score <= criterion.maxScore,
      `Self-check: skor ${item.score} di luar ${criterion.minScore}–${criterion.maxScore} untuk ${item.order}/${item.code}.`,
    );
  }
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

  for (const [orderKey, content] of Object.entries(spec.answers)) {
    const question = questions.get(Number(orderKey));
    if (!question) throw new Error(`Soal order ${orderKey} tidak ada pada assessment ${assessmentId}.`);
    await prisma.answer.upsert({
      where: { submissionId_questionId: { submissionId: submission.id, questionId: question.id } },
      update: { content },
      create: { submissionId: submission.id, questionId: question.id, content },
    });
  }

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

async function main() {
  verifySeedData();

  // Konten seed lama diganti total (soal ke-2 tanpa kriteria membuat validasi AI gagal).
  await prisma.assessment.deleteMany({ where: { id: "seed-uts-ipa" } });

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const userSpecs = [
    { email: "guru@demo.sch.id", name: "Bu Dewi Lestari", role: "TEACHER", identifier: "NIP-001", anonCode: "T-DEMO" },
    { email: "guru2@demo.sch.id", name: "Pak Rudi Hartono", role: "TEACHER", identifier: "NIP-002", anonCode: "T-DEMO2" },
    { email: "admin@demo.sch.id", name: "Admin Sekolah", role: "ADMIN", identifier: "NIP-ADM", anonCode: "A-DEMO" },
    ...Array.from({ length: 6 }, (_, i) => {
      const code = `S00${i + 1}`;
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
  const s001 = users["s001"];
  const s002 = users["s002"];
  const s003 = users["s003"];
  const s004 = users["s004"];
  const s006 = users["s006"];

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

  const memberships = [
    { classId: xiiA.id, studentId: users["s001"].id },
    { classId: xiiA.id, studentId: s002.id },
    { classId: xiiA.id, studentId: s003.id },
    { classId: xiiA.id, studentId: s004.id },
    { classId: xiiA.id, studentId: users["s005"].id },
    { classId: xiB.id, studentId: users["s005"].id },
    { classId: xiB.id, studentId: s006.id },
  ];
  for (const m of memberships) {
    await prisma.classMembership.upsert({
      where: { classId_studentId: m },
      update: {},
      create: m,
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

  const studentById: Record<string, string> = {
    s001: s001.id,
    s002: s002.id,
    s003: s003.id,
    s004: s004.id,
    s006: s006.id,
  };

  const submissions: Record<string, { id: string; version: number }> = {};
  for (const spec of UTS_SUBMISSIONS) {
    const submittedAt = spec.studentKey === "s003" ? S003_SUBMITTED_AT : spec.daysAgo === null ? null : daysAgo(spec.daysAgo);
    submissions[spec.studentKey] = await seedSubmission(
      uts.id,
      uts.questions,
      spec,
      studentById[spec.studentKey],
      submittedAt,
    );
  }

  for (const spec of XIB_SUBMISSIONS) {
    await seedSubmission(
      xiBEsai.id,
      xiBEsai.questions,
      spec,
      studentById[spec.studentKey],
      spec.daysAgo === null ? null : daysAgo(spec.daysAgo),
    );
  }

  const subS001 = submissions["s001"];
  const subS002 = submissions["s002"];

  const s001Total = S001_GRADE_ITEMS.reduce((sum, i) => sum + i.score, 0);
  await prisma.gradeRevision.upsert({
    where: { id: "seed-grade-s001" },
    update: {
      submissionId: subS001.id,
      authorId: guru.id,
      approvedById: guru.id,
      status: "FINAL",
      version: 1,
      totalScore: s001Total,
      approvedAt: daysAgo(1),
    },
    create: {
      id: "seed-grade-s001",
      submissionId: subS001.id,
      authorId: guru.id,
      approvedById: guru.id,
      status: "FINAL",
      version: 1,
      totalScore: s001Total,
      approvedAt: daysAgo(1),
    },
  });

  for (const item of S001_GRADE_ITEMS) {
    const criterion = criterionOf(uts, item.order, item.code);
    await prisma.gradeItem.upsert({
      where: {
        revisionId_questionId_criterionId: {
          revisionId: "seed-grade-s001",
          questionId: questionOf(uts, item.order).id,
          criterionId: criterion.id,
        },
      },
      update: { score: item.score, feedback: item.feedback, source: "MANUAL", aiResultId: null },
      create: {
        revisionId: "seed-grade-s001",
        questionId: questionOf(uts, item.order).id,
        criterionId: criterion.id,
        score: item.score,
        feedback: item.feedback,
        source: "MANUAL",
      },
    });
  }

  const pub = await prisma.publication.upsert({
    where: { revisionId: "seed-grade-s001" },
    update: {
      assessmentId: uts.id,
      publishedById: guru.id,
      publishedAt: hoursAgo(20),
    },
    create: {
      id: "seed-pub-s001",
      assessmentId: uts.id,
      revisionId: "seed-grade-s001",
      publishedById: guru.id,
      publishedAt: hoursAgo(20),
    },
  });

  const provider = process.env.LLM_PROVIDER ?? "openai-compatible";
  const model = process.env.LLM_MODEL ?? "";

  const llmQuestions: LlmQuestion[] = [1, 2].map((order) => {
    const question = questionOf(uts, order);
    return {
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
      answer: S002_ANSWERS[order],
    };
  });

  const aiItems = S002_AI_ITEMS.map((item) => ({
    questionId: questionOf(uts, item.order).id,
    criterionId: criterionOf(uts, item.order, item.code).id,
    score: item.score,
    evidence: item.evidence,
    rationale: item.rationale,
    feedback: item.feedback,
  }));

  await prisma.aIResult.upsert({
    where: { id: "seed-ai-s002" },
    update: {
      submissionId: subS002.id,
      requestedById: guru.id,
      provider,
      model,
      promptVersion: PROMPT_VERSION,
      cacheKey: cacheKey({
        submissionId: subS002.id,
        version: subS002.version,
        questions: llmQuestions,
        provider,
        model,
      }),
      sourceVersion: subS002.version,
      payload: { items: aiItems },
      validationOk: true,
      validationMsg: null,
      tokenUsed: 912,
      attemptedAt: hoursAgo(3),
    },
    create: {
      id: "seed-ai-s002",
      submissionId: subS002.id,
      requestedById: guru.id,
      provider,
      model,
      promptVersion: PROMPT_VERSION,
      cacheKey: cacheKey({
        submissionId: subS002.id,
        version: subS002.version,
        questions: llmQuestions,
        provider,
        model,
      }),
      sourceVersion: subS002.version,
      payload: { items: aiItems },
      validationOk: true,
      validationMsg: null,
      tokenUsed: 912,
      attemptedAt: hoursAgo(3),
    },
  });

  const auditEvents = [
    {
      id: "seed-audit-1",
      actorId: s001.id,
      action: "SUBMIT" as const,
      entityType: "Submission",
      entityId: subS001.id,
      versionBefore: null,
      versionAfter: 1,
      createdAt: daysAgo(2),
    },
    {
      id: "seed-audit-2",
      actorId: guru.id,
      action: "APPROVE" as const,
      entityType: "GradeRevision",
      entityId: "seed-grade-s001",
      versionBefore: 1,
      versionAfter: 1,
      createdAt: daysAgo(1),
    },
    {
      id: "seed-audit-3",
      actorId: guru.id,
      action: "PUBLISH" as const,
      entityType: "Publication",
      entityId: pub.id,
      versionBefore: null,
      versionAfter: null,
      createdAt: hoursAgo(20),
    },
  ];

  for (const { id, ...data } of auditEvents) {
    await prisma.auditEvent.upsert({ where: { id }, update: data, create: { id, ...data } });
  }

  await prisma.idempotencyKey.upsert({
    where: { key: "seed-publish-s001" },
    update: { userId: guru.id, scope: "publish" },
    create: { key: "seed-publish-s001", userId: guru.id, scope: "publish" },
  });

  console.log(`
Seed demo selesai.

Login: /login (password semua akun: ${DEMO_PASSWORD})
  Guru     guru@demo.sch.id   (Bu Dewi Lestari)
  Guru     guru2@demo.sch.id  (Pak Rudi Hartono)
  Admin    admin@demo.sch.id
  Siswa    s001@demo.sch.id .. s006@demo.sch.id

Kode join kelas: XII A = XIIA01, XI B = XIB02

Status LJK (Asesmen Tengah Semester — Teks Argumentasi):
  s001  terbit (nilai 18, revisi FINAL + publication)
  s002  siap dinilai (jawaban terkumpul, draf AI siap diterapkan, belum ada nilai)
  s003  terkumpul, belum dinilai (jalur manual)
  s004  dikerjakan (IN_PROGRESS, belum dikumpulkan)
  s005  belum mengumpulkan
  s006  terkumpul di XI B (uji 403 guru lintas kelas)

Asesmen lain:
  Latihan — Teks Eksposisi (DRAFT, XII A): belum ada pengerjaan
  Ulangan Harian — Teks Eksposisi (XI B, CLOSED): 1 pengumpulan
`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
