import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireClassMember, requireClassOwner, requireTeacher, requireUser, route } from "@/lib/auth/guard";
import { ok, readJson } from "@/lib/http";
import { conflict, forbidden, validationError } from "@/lib/api-error";
import { uniqueJoinCode } from "@/lib/join-code";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();

  if (user.role === "TEACHER") {
    await requireClassOwner(id, user);
    const klas = await prisma.class.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        joinCode: true,
        _count: { select: { memberships: true, assessments: true } },
      },
    });
    return ok({
      id: klas!.id,
      name: klas!.name,
      joinCode: klas!.joinCode,
      memberCount: klas!._count.memberships,
      assessmentCount: klas!._count.assessments,
    });
  }

  // Siswa: hanya anggota; jangan bocorkan joinCode/pemilik ke siswa non-anggota.
  await requireClassMember(id, user);
  const klas = await prisma.class.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!klas) throw forbidden();
  return ok({ id: klas.id, name: klas.name });
});

const patchSchema = z.object({
  name: z.string().trim().min(1, "Nama kelas wajib diisi.").max(100).optional(),
  rotateJoinCode: z.boolean().optional(),
});

export const PATCH = route(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const teacher = await requireTeacher();
  await requireClassOwner(id, teacher);

  const parsed = patchSchema.safeParse(await readJson(req));
  if (!parsed.success) throw validationError(parsed.error.flatten());
  const { name, rotateJoinCode } = parsed.data;
  if (name === undefined && rotateJoinCode !== true) {
    throw validationError({ body: "Kirim minimal satu field: name atau rotateJoinCode." });
  }

  const joinCode =
    rotateJoinCode === true
      ? await uniqueJoinCode(async (code) => {
          const found = await prisma.class.findUnique({ where: { joinCode: code }, select: { id: true } });
          return Boolean(found);
        })
      : undefined;

  const updated = await prisma.class.update({
    where: { id },
    data: { ...(name !== undefined && { name }), ...(joinCode !== undefined && { joinCode }) },
    select: {
      id: true,
      name: true,
      joinCode: true,
      _count: { select: { memberships: true, assessments: true } },
    },
  });

  return ok({
    id: updated.id,
    name: updated.name,
    joinCode: updated.joinCode,
    memberCount: updated._count.memberships,
    assessmentCount: updated._count.assessments,
  });
});

export const DELETE = route(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const teacher = await requireTeacher();
  await requireClassOwner(id, teacher);

  const counts = await prisma.class.findUnique({
    where: { id },
    select: { _count: { select: { assessments: true } } },
  });

  if (counts!._count.assessments > 0) {
    throw conflict("Kelas masih memiliki asesmen. Hapus asesmen terlebih dahulu.");
  }

  await prisma.$transaction([
    prisma.classMembership.deleteMany({ where: { classId: id } }),
    prisma.class.delete({ where: { id } }),
  ]);

  return new Response(null, { status: 204 });
});
