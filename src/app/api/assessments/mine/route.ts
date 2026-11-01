import { prisma } from "@/lib/prisma";
import { requireStudent, route } from "@/lib/auth/guard";
import { ok } from "@/lib/http";

export const GET = route(async () => {
  const student = await requireStudent();
  const assessments = await prisma.assessment.findMany({
    where: {
      status: "OPEN",
      class: { memberships: { some: { studentId: student.id } } },
    },
    orderBy: { openedAt: "desc" },
    select: {
      id: true,
      title: true,
      instruction: true,
      durationMinutes: true,
      class: { select: { id: true, name: true } },
      _count: { select: { questions: true } },
      submissions: {
        where: { studentId: student.id },
        select: { status: true, version: true, submittedAt: true },
        take: 1,
      },
    },
  });

  return ok({
    assessments: assessments.map((a) => ({
      id: a.id,
      title: a.title,
      instruction: a.instruction,
      durationMinutes: a.durationMinutes,
      class: a.class,
      questionCount: a._count.questions,
      submission: a.submissions[0] ?? null,
    })),
  });
});
