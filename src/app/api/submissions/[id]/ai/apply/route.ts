import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTeacher, route } from "@/lib/auth/guard";
import { conflict, notFound, validationError } from "@/lib/api-error";
import { ok, readJson } from "@/lib/http";
import { teacherSubmission } from "@/lib/grading";

type Ctx = { params: Promise<{ id: string }> };
type Item = { questionId: string; criterionId: string; score: number; feedback: string };
type ExistingItem = { questionId: string; criterionId: string; score: number | null; feedback?: string; source: "MANUAL" | "AI" };
const schema = z.object({ aiResultId: z.string(), version: z.number().int().positive() });

export function mergeAiItems(existing: ExistingItem[], aiItems: Item[]) {
  const manual = existing.filter((i) => i.source === "MANUAL");
  const manualKeys = new Set(manual.map((i) => `${i.questionId}:${i.criterionId}`));
  const items = aiItems.filter((i) => !manualKeys.has(`${i.questionId}:${i.criterionId}`));
  // total hanya dari item berskor; nilai kosong bukan nol.
  const totalScore = [...manual, ...items].reduce((sum, i) => (i.score === null ? sum : sum + i.score), 0);
  return { items, manual, totalScore };
}

export const POST = route(async (req, ctx: Ctx) => {
  const teacher = await requireTeacher();
  const { id } = await ctx.params;
  const submission = await teacherSubmission(id, teacher);
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) throw validationError(parsed.error.flatten());
  if (parsed.data.version !== submission.version) throw conflict("LJK berubah. Muat ulang sebelum menerapkan AI.");
  const ai = await prisma.aIResult.findFirst({ where: { id: parsed.data.aiResultId, submissionId: id, validationOk: true }, select: { payload: true, sourceVersion: true } });
  if (!ai) throw notFound("Hasil AI");
  if (ai.sourceVersion !== submission.version) throw conflict("Jawaban berubah sejak saran AI dibuat.");
  const payload = ai.payload as { items?: Item[] };
  if (!payload.items?.length) throw validationError({ ai: "Payload AI kosong." });
  const result = await prisma.$transaction(async (tx) => {
    // ambil revisi TERBARU apa pun statusnya agar nilai guru tidak hilang
    const latest = await tx.gradeRevision.findFirst({ where: { submissionId: id }, orderBy: { version: "desc" }, select: { id: true, version: true, status: true, items: { select: { questionId: true, criterionId: true, score: true, feedback: true, source: true } } } });
    const { items: aiItems, manual, totalScore } = mergeAiItems(latest?.items ?? [], payload.items!);
    const aiCreate = aiItems.map((i) => ({ questionId: i.questionId, criterionId: i.criterionId, score: i.score, feedback: i.feedback, source: "AI" as const, aiResultId: parsed.data.aiResultId }));
    if (latest?.status === "DRAFT") {
      return tx.gradeRevision.update({ where: { id: latest.id }, data: { totalScore, version: { increment: 1 }, items: { deleteMany: { source: "AI" as const }, create: aiCreate } }, select: { id: true, version: true, status: true, totalScore: true } });
    }
    // revisi terbaru FINAL (atau belum ada): buat DRAFT baru, warisi item manual
    return tx.gradeRevision.create({
      data: {
        submissionId: id,
        authorId: teacher.id,
        version: (latest?.version ?? 0) + 1,
        totalScore,
        items: { create: [...manual.map((i) => ({ questionId: i.questionId, criterionId: i.criterionId, score: i.score, feedback: i.feedback ?? "", source: "MANUAL" as const })), ...aiCreate] },
      },
      select: { id: true, version: true, status: true, totalScore: true },
    });
  });
  return ok({ revision: result });
});
