import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { BadgeCheck, BookOpen, FileText, ListChecks } from "lucide-react";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/prisma";
import { AssessmentList } from "./assessment-list";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";

export const metadata = { title: "Ruang belajar — ESAINA" };

function expiredIdsOf(items: { id: string; durationMinutes: number; openedAt: Date | null }[]) {
  const now = Date.now();
  return items
    .filter((a) => {
      if (a.durationMinutes === 0 || !a.openedAt) return false;
      const deadline = a.openedAt.getTime() + a.durationMinutes * 60_000;
      return now > deadline;
    })
    .map((a) => a.id);
}

export default async function StudentHome() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "STUDENT") redirect(session.user.role === "ADMIN" ? "/admin" : "/guru");

  const [classCount, publishedResults, assessments] = await Promise.all([
    prisma.classMembership.count({ where: { studentId: session.user.id } }),
    prisma.assessment.count({
      where: {
        class: { memberships: { some: { studentId: session.user.id } } },
        publications: { some: { revision: { submission: { studentId: session.user.id } } } },
      },
    }),
    prisma.assessment.findMany({
      where: { status: "OPEN", class: { memberships: { some: { studentId: session.user.id } } } },
      orderBy: { openedAt: "desc" },
      select: {
        id: true,
        title: true,
        durationMinutes: true,
        openedAt: true,
        closedAt: true,
        class: { select: { name: true } },
        _count: { select: { questions: true } },
        submissions: {
          where: { studentId: session.user.id },
          select: { status: true },
          take: 1,
        },
      },
    }),
  ]);

  const openAssessments = assessments.length;
  const todo = assessments.filter((a) => {
    const status = a.submissions[0]?.status;
    return !status || status === "IN_PROGRESS";
  });
  const expiredIds = expiredIdsOf(todo);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold text-primary">Ruang belajar</h1>
          <p className="text-sm text-muted-foreground">Halo, {session.user.name}. Kerjakan asesmen dan lihat hasil yang sudah diterbitkan.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="soft">
            <Link href="/siswa/classes">Kelola kelas</Link>
          </Button>
          {publishedResults > 0 ? (
            <Button asChild variant="soft">
              <Link href="/siswa/results">Lihat hasil</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Kelas diikuti" value={classCount} icon={BookOpen} />
        <StatCard label="Asesmen terbuka" value={openAssessments} icon={FileText} />
        <StatCard
          label="Belum dikerjakan"
          value={todo.length}
          icon={ListChecks}
          tone={todo.length > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Hasil terbit"
          value={publishedResults}
          icon={BadgeCheck}
          tone={publishedResults > 0 ? "success" : "default"}
        />
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold text-primary">Asesmen</h2>
          <p className="text-sm text-muted-foreground">Kerjakan yang belum dikumpulkan, atau lihat yang sudah selesai.</p>
        </div>
        <AssessmentList expiredIds={expiredIds} />
      </section>
    </main>
  );
}
