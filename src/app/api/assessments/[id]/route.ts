import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireClassOwner, requireTeacher, route } from "@/lib/auth/guard";
import { conflict, notFound, validationError } from "@/lib/api-error";
import { ok, readJson } from "@/lib/http";
import { updateAssessmentSchema } from "@/lib/validations/assessment";

type Ctx = { params: Promise<{ id: string }> };
const bodySchema = z.object({ version: z.number().int().positive() }).and(updateAssessmentSchema);

export const GET = route(async (_req, ctx: Ctx) => {
  const teacher = await requireTeacher();
  const { id } = await ctx.params;
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { order: "asc" }, include: { criteria: { orderBy: { order: "asc" } } } },
    },
  });
  if (!assessment) throw notFound("Asesmen");
  await requireClassOwner(assessment.classId, teacher);
  return ok({ assessment });
});

export const PUT = route(async (req, ctx: Ctx) => {
  const teacher = await requireTeacher();
  const { id } = await ctx.params;
  const current = await prisma.assessment.findUnique({ where: { id } });
  if (!current) throw notFound("Asesmen");
  await requireClassOwner(current.classId, teacher);
  if (current.status !== "DRAFT") throw conflict("Struktur asesmen terkunci setelah asesmen dibuka.");

  const parsed = bodySchema.safeParse(await readJson(req));
  if (!parsed.success) throw validationError(parsed.error.flatten());
  if (parsed.data.version !== current.version) {
    throw conflict("Asesmen berubah di tab lain. Muat ulang sebelum menyimpan.");
  }

  const { title, instruction, durationMinutes, questions } = parsed.data;
  const updated = await prisma.$transaction(async (tx) => {
    await tx.question.deleteMany({ where: { assessmentId: id } });
    return tx.assessment.update({
      where: { id, version: parsed.data.version },
      data: {
        title,
        instruction,
        durationMinutes,
        version: { increment: 1 },
        questions: {
          create: questions.map((q) => ({
            order: q.order,
            text: q.text,
            referenceAnswer: q.referenceAnswer,
            maxScore: q.maxScore,
            criteria: {
              create: q.criteria.map((c, i) => ({
                code: c.code,
                description: c.description,
                minScore: c.minScore,
                maxScore: c.maxScore,
                levels: c.levels ?? {},
                order: i + 1,
              })),
            },
          })),
        },
      },
      select: { id: true, version: true, status: true },
    });
  });
  return ok(updated);
});

export const DELETE = route(async (_req, ctx: Ctx) => {
  const teacher = await requireTeacher();
  const { id } = await ctx.params;
  const current = await prisma.assessment.findUnique({ where: { id } });
  if (!current) throw notFound("Asesmen");
  await requireClassOwner(current.classId, teacher);
  if (current.status !== "DRAFT") throw conflict("Asesmen yang sudah dibuka tidak dapat dihapus.");
  await prisma.assessment.delete({ where: { id } });
  return new Response(null, { status: 204 });
});
