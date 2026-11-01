import { z } from "zod";

const criterionSchema = z
  .object({
    code: z.string().trim().min(1, "Kode kriteria wajib diisi.").max(10),
    description: z.string().trim().min(1, "Deskripsi kriteria wajib diisi.").max(500),
    minScore: z.number().int("Skor minimum harus bilangan bulat.").min(0),
    maxScore: z.number().int("Skor maksimum harus bilangan bulat.").min(0),
    levels: z.record(z.string(), z.string()).optional(),
  })
  .refine((c) => c.maxScore >= c.minScore, {
    message: "Skor maksimum kriteria tidak boleh kurang dari minimum.",
    path: ["maxScore"],
  });

const questionSchema = z.object({
  order: z.number().int().positive(),
  text: z.string().trim().min(1, "Teks soal wajib diisi.").max(2000),
  referenceAnswer: z.string().trim().min(1, "Jawaban acuan wajib diisi.").max(5000),
  maxScore: z.number().int().min(1).max(100),
  criteria: z.array(criterionSchema).min(1, "Setiap soal butuh minimal satu kriteria rubrik."),
});

function uniqueBy<T>(items: T[], key: (item: T) => string): boolean {
  return new Set(items.map(key)).size === items.length;
}

export const createAssessmentSchema = z
  .object({
    title: z.string().trim().min(1, "Judul asesmen wajib diisi.").max(200),
    instruction: z.string().trim().max(2000).default(""),
    durationMinutes: z.number().int().min(0).max(600).default(60),
    questions: z.array(questionSchema).min(1, "Asesmen butuh minimal satu soal."),
  })
  .superRefine((data, ctx) => {
    if (!uniqueBy(data.questions, (q) => String(q.order))) {
      ctx.addIssue({ code: "custom", message: "Nomor soal tidak boleh berulang.", path: ["questions"] });
    }
    data.questions.forEach((q, qi) => {
      if (!uniqueBy(q.criteria, (c) => c.code)) {
        ctx.addIssue({
          code: "custom",
          message: `Kode kriteria soal ${q.order} tidak boleh berulang.`,
          path: ["questions", qi, "criteria"],
        });
      }
    });
  });

export const updateAssessmentSchema = createAssessmentSchema;

export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;
