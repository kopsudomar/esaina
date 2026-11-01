import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { FileText } from "lucide-react";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/prisma";
import { AssessmentStatusBadge } from "@/components/assessment-status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Asesmen — ESAINA" };

export default async function AssessmentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN") redirect("/guru");

  const isAdmin = session.user.role === "ADMIN";

  const assessments = await prisma.assessment.findMany({
    where: isAdmin ? undefined : { class: { teacherId: session.user.id } },
    include: {
      class: { select: { name: true } },
      _count: { select: { questions: true, submissions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-primary">Asesmen</h1>
        <p className="text-sm text-muted-foreground">
          Semua asesmen lintas kelas yang Anda kelola.
        </p>
      </header>

      {assessments.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Belum ada asesmen"
          description="Buat asesmen dari ruang kerja guru untuk mulai menilai esai."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asesmen</TableHead>
              <TableHead>Kelas</TableHead>
              <TableHead>Soal</TableHead>
              <TableHead>LJK</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assessments.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.title}</TableCell>
                <TableCell>{a.class.name}</TableCell>
                <TableCell>{a._count.questions}</TableCell>
                <TableCell>{a._count.submissions}</TableCell>
                <TableCell>
                  <AssessmentStatusBadge status={a.status} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="default">
                      <Link href={`/guru/assessments/${a.id}`}>Detail</Link>
                    </Button>
                    <Button asChild size="sm" variant="soft">
                      <Link href={`/guru/assessments/${a.id}/submissions`}>Nilai</Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
