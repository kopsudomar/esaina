import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { BookOpen, GraduationCap, Users } from "lucide-react";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Kelas — ESAINA" };

export default async function AdminClassesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect(session.user.role === "TEACHER" ? "/guru" : "/siswa");

  const classes = await prisma.class.findMany({
    include: {
      teacher: { select: { name: true, identifier: true } },
      _count: { select: { memberships: true, assessments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalTeachers = new Set(classes.map((k) => k.teacherId)).size;
  const totalMembers = classes.reduce((sum, k) => sum + k._count.memberships, 0);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-primary">Kelas</h1>
        <p className="text-sm text-muted-foreground">Semua kelas di platform ESAINA lintas guru pengampu.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total kelas" value={classes.length} icon={BookOpen} />
        <StatCard label="Guru pengampu" value={totalTeachers} icon={GraduationCap} />
        <StatCard label="Total anggota" value={totalMembers} icon={Users} />
      </div>

      {classes.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Belum ada kelas"
          description="Kelas dibuat oleh guru. Setelah guru membuat kelas, daftarnya muncul di sini."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kelas</TableHead>
              <TableHead>Kode gabung</TableHead>
              <TableHead>Guru</TableHead>
              <TableHead>Anggota</TableHead>
              <TableHead>Asesmen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.map((k) => (
              <TableRow key={k.id}>
                <TableCell className="font-medium">{k.name}</TableCell>
                <TableCell className="tabular-nums">{k.joinCode}</TableCell>
                <TableCell>
                  {k.teacher.name}
                  {k.teacher.identifier ? (
                    <span className="block text-xs text-muted-foreground">{k.teacher.identifier}</span>
                  ) : null}
                </TableCell>
                <TableCell className="tabular-nums">{k._count.memberships}</TableCell>
                <TableCell className="tabular-nums">{k._count.assessments}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
