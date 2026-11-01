import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { BookOpen, ClipboardList, Users } from "lucide-react";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/prisma";
import { AssessmentStatusBadge } from "@/components/assessment-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Detail kelas — ESAINA" };

type Props = { params: Promise<{ id: string }> };

export default async function ClassDetailPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN") redirect("/guru");

  const { id } = await params;
  const klas = await prisma.class.findUnique({
    where: { id },
    include: {
      _count: { select: { memberships: true, assessments: true } },
      assessments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          _count: { select: { questions: true, submissions: true } },
        },
      },
      memberships: {
        orderBy: { joinedAt: "asc" },
        select: { id: true, student: { select: { name: true, identifier: true } } },
      },
    },
  });

  if (!klas) notFound();
  if (klas.teacherId !== session.user.id && session.user.role !== "ADMIN") notFound();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold text-primary">{klas.name}</h1>
          <Badge variant="soft">Kode {klas.joinCode}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {klas._count.memberships} anggota · {klas._count.assessments} asesmen
        </p>
      </header>

      <Tabs defaultValue="asesmen">
        <TabsList>
          <TabsTrigger value="asesmen">Asesmen</TabsTrigger>
          <TabsTrigger value="anggota">Anggota</TabsTrigger>
        </TabsList>

        <TabsContent value="asesmen">
          {klas.assessments.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="Belum ada asesmen"
              description="Buat asesmen dari ruang kerja guru untuk kelas ini."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asesmen</TableHead>
                  <TableHead>Soal</TableHead>
                  <TableHead>LJK</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {klas.assessments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell>{a._count.questions}</TableCell>
                    <TableCell>{a._count.submissions}</TableCell>
                    <TableCell>
                      <AssessmentStatusBadge status={a.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button asChild size="sm" variant="default">
                          <Link href={`/guru/assessments/${a.id}/submissions`}>Buka LJK</Link>
                        </Button>
                        <Button asChild size="sm" variant="soft">
                          <Link href={`/guru/assessments/${a.id}`}>Detail</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="anggota">
          {klas.memberships.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Belum ada anggota"
              description="Bagikan kode gabung agar siswa dapat bergabung."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>NIP-NIS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {klas.memberships.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.student.name}</TableCell>
                    <TableCell>
                      {m.student.identifier ?? (
                        <span className="text-muted-foreground">Belum diisi</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/guru">
            <ClipboardList className="size-4" aria-hidden /> Kembali ke ruang kerja
          </Link>
        </Button>
      </div>
    </main>
  );
}
