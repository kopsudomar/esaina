import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Activity, ClipboardList, FileText, FileX } from "lucide-react";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export const metadata = { title: "Asesmen — ESAINA" };

const STATUS: Record<string, { label: string; variant: "soft" | "success" | "warning" }> = {
  DRAFT: { label: "Draf", variant: "soft" },
  OPEN: { label: "Dibuka", variant: "success" },
  CLOSED: { label: "Ditutup", variant: "warning" },
};

export default async function AdminAssessmentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect(session.user.role === "TEACHER" ? "/guru" : "/siswa");

  const assessments = await prisma.assessment.findMany({
    include: {
      class: { select: { name: true, teacher: { select: { name: true } } } },
      _count: { select: { questions: true, submissions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const open = assessments.filter((a) => a.status === "OPEN").length;
  const closed = assessments.filter((a) => a.status === "CLOSED").length;
  const draft = assessments.filter((a) => a.status === "DRAFT").length;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-primary">Asesmen</h1>
        <p className="text-sm text-muted-foreground">Semua asesmen lintas kelas beserta statusnya.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total asesmen" value={assessments.length} icon={FileText} />
        <StatCard label="Dibuka" value={open} icon={Activity} tone="success" />
        <StatCard label="Ditutup" value={closed} icon={FileX} tone="warning" />
        <StatCard label="Draf" value={draft} icon={ClipboardList} />
      </div>

      {assessments.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Belum ada asesmen"
          description="Asesmen dibuat oleh guru. Setelah dibuat, statusnya muncul di sini."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asesmen</TableHead>
              <TableHead>Kelas</TableHead>
              <TableHead>Guru</TableHead>
              <TableHead>Soal</TableHead>
              <TableHead>LJK</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assessments.map((a) => {
              const meta = STATUS[a.status] ?? { label: a.status, variant: "soft" as const };
              return (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.title}</TableCell>
                  <TableCell>{a.class.name}</TableCell>
                  <TableCell>{a.class.teacher.name}</TableCell>
                  <TableCell className="tabular-nums">{a._count.questions}</TableCell>
                  <TableCell className="tabular-nums">{a._count.submissions}</TableCell>
                  <TableCell>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button asChild variant="soft" size="sm">
                      <Link href="/admin/monitoring">Pantau</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
