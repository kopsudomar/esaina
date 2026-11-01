import { prisma } from "@/lib/prisma";
import { requireClassOwner, requireTeacher, route } from "@/lib/auth/guard";
import { ok } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const teacher = await requireTeacher();
  await requireClassOwner(id, teacher);

  const memberships = await prisma.classMembership.findMany({
    where: { classId: id },
    orderBy: { student: { name: "asc" } },
    select: { joinedAt: true, student: { select: { id: true, name: true } } },
  });

  return ok({
    students: memberships.map((m) => ({
      id: m.student.id,
      name: m.student.name,
      joinedAt: m.joinedAt,
    })),
  });
});
