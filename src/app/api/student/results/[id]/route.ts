import { prisma } from "@/lib/prisma";
import { requireStudent, route } from "@/lib/auth/guard";
import { notFound } from "@/lib/api-error";
import { ok } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<[Ctx]>(async (_req, ctx) => {
  const student = await requireStudent();
  const { id } = await ctx.params;
  const publication = await prisma.publication.findFirst({
    where: { id, revision: { status: "FINAL", submission: { studentId: student.id } } },
    select: {
      id: true,
      publishedAt: true,
      assessment: { select: { id: true, title: true } },
      revision: {
        select: {
          totalScore: true,
          items: {
            orderBy: { questionId: "asc" },
            select: {
              questionId: true,
              criterionId: true,
              score: true,
              feedback: true,
              criterion: { select: { code: true, description: true } },
            },
          },
          submission: {
            select: {
              assessment: {
                select: {
                  questions: {
                    orderBy: { order: "asc" },
                    select: {
                      id: true,
                      order: true,
                      text: true,
                      criteria: { select: { id: true, code: true, maxScore: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!publication) throw notFound("Hasil asesmen");
  return ok(publication);
});
