import { prisma } from "@/lib/prisma";
import { requireTeacher, route } from "@/lib/auth/guard";
import { conflict } from "@/lib/api-error";
import { ok } from "@/lib/http";
import { sumScores, teacherSubmission } from "@/lib/grading";

type Ctx = { params: Promise<{ id: string }> };

/** Buka revisi atas nilai FINAL: salin items revisi terakhir ke DRAFT baru. */
export const POST = route<[Ctx]>(async (_req, ctx) => {
  const teacher = await requireTeacher();
  const { id } = await ctx.params;
  const submission = await teacherSubmission(id, teacher);
  if (submission.status !== "SUBMITTED") throw conflict("LJK belum dikumpulkan.");

  const last = await prisma.gradeRevision.findFirst({
    where: { submissionId: id },
    orderBy: { version: "desc" },
    select: { id: true, status: true, version: true, items: { select: { questionId: true, criterionId: true, score: true, feedback: true } } },
  });
  if (!last || last.status !== "FINAL") throw conflict("Hanya nilai final yang dapat direvisi.");

  const revision = await prisma.$transaction(async (tx) => {
    const created = await tx.gradeRevision.create({
      data: {
        submissionId: id,
        authorId: teacher.id,
        version: last.version + 1,
        totalScore: sumScores(last.items),
        items: { create: last.items.map((i) => ({ ...i })) },
      },
      select: { id: true, version: true, status: true, totalScore: true },
    });
    await tx.auditEvent.create({
      data: { actorId: teacher.id, action: "CHANGE_GRADE", entityType: "GradeRevision", entityId: created.id, versionBefore: last.version, versionAfter: created.version },
    });
    return created;
  });
  return ok({ revision });
});
