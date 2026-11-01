import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTeacher, route } from "@/lib/auth/guard";
import { conflict, notFound, validationError } from "@/lib/api-error";
import { ok, readJson } from "@/lib/http";

 type Ctx = { params: Promise<{ id: string }> };
const publishSchema = z.object({ submissionIds: z.array(z.string()).min(1), idempotencyKey: z.string().min(8).max(100) });

export const GET = route<[Ctx]>(async (_req, ctx) => {
  const teacher = await requireTeacher();
  const { id } = await ctx.params;
  const assessment = await prisma.assessment.findUnique({ where: { id }, select: { id: true, title: true, class: { select: { teacherId: true } } } });
  if (!assessment || assessment.class.teacherId !== teacher.id) throw notFound("Asesmen");
  const rows = await prisma.submission.findMany({ where: { assessmentId: id, status: "SUBMITTED" }, orderBy: { submittedAt: "asc" }, select: { id: true, student: { select: { anonCode: true } }, submittedAt: true, gradeRevisions: { where: { status: "FINAL" }, orderBy: { version: "desc" }, take: 1, select: { id: true, totalScore: true, version: true, publications: { select: { id: true, publishedAt: true } } } } } });
  return ok({ assessment: { id: assessment.id, title: assessment.title }, submissions: rows.map((s) => { const r = s.gradeRevisions[0]; return { id: s.id, anonCode: s.student.anonCode, submittedAt: s.submittedAt, revisionId: r?.id ?? null, totalScore: r?.totalScore ?? null, published: Boolean(r?.publications.length), publishedAt: r?.publications[0]?.publishedAt ?? null }; }) });
});

export const POST = route<[Ctx]>(async (req, ctx) => {
  const teacher = await requireTeacher();
  const { id } = await ctx.params;
  const parsed = publishSchema.safeParse(await readJson(req));
  if (!parsed.success) throw validationError(parsed.error.flatten());
  const assessment = await prisma.assessment.findUnique({ where: { id }, select: { id: true, class: { select: { teacherId: true } } } });
  if (!assessment || assessment.class.teacherId !== teacher.id) throw notFound("Asesmen");
  const existingKey = await prisma.idempotencyKey.findUnique({ where: { key: parsed.data.idempotencyKey } });
  if (existingKey) {
    if (existingKey.userId !== teacher.id || existingKey.scope !== "publish") throw conflict("Kunci idempotensi tidak valid.");
    return ok({ published: 0, replayed: true });
  }
  // Ambil revisi FINAL terakhir tiap submission (revisi lama yang sudah terbit tetap ada).
  const finalRevisions = await prisma.gradeRevision.findMany({ where: { submissionId: { in: parsed.data.submissionIds }, status: "FINAL", submission: { assessmentId: id } }, orderBy: { version: "desc" }, select: { id: true, submissionId: true } });
  const latest = new Map<string, string>();
  for (const r of finalRevisions) if (!latest.has(r.submissionId)) latest.set(r.submissionId, r.id);
  const revisions = parsed.data.submissionIds.map((sid) => ({ id: latest.get(sid)!, submissionId: sid }));
  if (revisions.some((r) => !r.id)) throw conflict("Hanya nilai final asesmen ini yang dapat diterbitkan.");
  const result = await prisma.$transaction(async (tx) => {
    await tx.idempotencyKey.create({ data: { key: parsed.data.idempotencyKey, userId: teacher.id, scope: "publish" } });
    const existing = await tx.publication.findMany({ where: { revisionId: { in: revisions.map((r) => r.id) } }, select: { revisionId: true } });
    const fresh = revisions.filter((r) => !existing.some((e) => e.revisionId === r.id));
    if (fresh.length) await tx.publication.createMany({ data: fresh.map((r) => ({ assessmentId: id, revisionId: r.id, publishedById: teacher.id })) });
    await tx.auditEvent.create({ data: { actorId: teacher.id, action: "PUBLISH", entityType: "Assessment", entityId: id } });
    return fresh.length;
  }).catch((error) => {
    // Klik ganda balapan: kunci sudah dibuat transaksi lain -> anggap replay.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
    throw error;
  });
  if (result === null) return ok({ published: 0, replayed: true });
  return ok({ published: result, replayed: false });
});
