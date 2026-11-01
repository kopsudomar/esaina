import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { CheckCircle2, ClipboardList, FileText, Pencil, Send } from "lucide-react";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/prisma";
import { AssessmentStatusBadge } from "@/components/assessment-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OpenAssessment } from "./open-assessment";

type Props = { params: Promise<{ id: string }> };

export default async function AssessmentDetailPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN") redirect("/guru");

  const { id } = await params;
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: {
      class: { select: { id: true, name: true, teacherId: true } },
      questions: {
        orderBy: { order: "asc" },
        include: { criteria: { orderBy: { order: "asc" } } },
      },
      submissions: {
        select: { status: true, gradeRevisions: { select: { status: true } } },
      },
    },
  });

  if (!assessment) notFound();
  if (assessment.class.teacherId !== session.user.id && session.user.role !== "ADMIN") notFound();

  const submitted = assessment.submissions.filter((s) => s.status === "SUBMITTED");
  const ungraded = submitted.filter((s) => !s.gradeRevisions.some((r) => r.status === "FINAL"));
  const draft = submitted.filter((s) => s.gradeRevisions.some((r) => r.status === "DRAFT"));
  const final = submitted.filter((s) => s.gradeRevisions.some((r) => r.status === "FINAL"));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold text-primary">{assessment.title}</h1>
          <AssessmentStatusBadge status={assessment.status} />
          <Badge variant="soft">
            {assessment.durationMinutes > 0 ? `${assessment.durationMinutes} menit` : "Tanpa batas"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Kelas{" "}
          <Link href={`/guru/classes/${assessment.class.id}`} className="underline">
            {assessment.class.name}
          </Link>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="default">
            <Link href={`/guru/assessments/${assessment.id}/submissions`}>Nilai LJK</Link>
          </Button>
          <Button asChild variant="default">
            <Link href={`/guru/assessments/${assessment.id}/publication`}>Publikasi</Link>
          </Button>
          <Button asChild variant="soft">
            <a href={`/api/assessments/${assessment.id}/export`}>Ekspor CSV</a>
          </Button>
          {assessment.status === "DRAFT" ? (
            <OpenAssessment assessmentId={assessment.id} version={assessment.version} />
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="LJK terkumpul" value={submitted.length} icon={ClipboardList} />
        <StatCard label="Belum dinilai" value={ungraded.length} icon={Send} tone={ungraded.length > 0 ? "warning" : "default"} />
        <StatCard label="Draf" value={draft.length} icon={Pencil} tone={draft.length > 0 ? "warning" : "default"} />
        <StatCard label="Final" value={final.length} icon={CheckCircle2} tone="success" />
      </div>

      <Tabs defaultValue="soal">
        <TabsList>
          <TabsTrigger value="soal">Soal &amp; rubrik</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>

        <TabsContent value="soal" className="flex flex-col gap-4">
          {assessment.questions.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Belum ada soal"
              description="Asesmen ini belum memiliki soal."
            />
          ) : (
            assessment.questions.map((q) => (
              <Card key={q.id} className="gap-3">
                <CardHeader>
                  <CardTitle className="text-lg text-primary">
                    Soal {q.order}
                  </CardTitle>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{q.text}</p>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Rubrik ({q.maxScore} poin)
                    </p>
                    <ul className="flex flex-col gap-1">
                      {q.criteria.map((c) => (
                        <li key={c.id} className="text-sm">
                          <span className="font-semibold">{c.code}</span> · {c.description}{" "}
                          <span className="text-muted-foreground">({c.minScore}–{c.maxScore})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <details className="rounded-[var(--neu-radius-control)] border border-[color:var(--border)] bg-[var(--neu-surface-soft)] px-3 py-2 text-sm">
                    <summary className="cursor-pointer font-medium">Kunci jawaban acuan</summary>
                    <p className="mt-2 whitespace-pre-wrap leading-relaxed">{q.referenceAnswer}</p>
                  </details>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="info" className="flex flex-col gap-4">
          <Card className="gap-2">
            <CardHeader>
              <CardTitle className="text-lg text-primary">Instruksi</CardTitle>
            </CardHeader>
            <CardContent>
              {assessment.instruction.trim() ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{assessment.instruction}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Tanpa instruksi tambahan.</p>
              )}
            </CardContent>
          </Card>
          <Card className="gap-2">
            <CardHeader>
              <CardTitle className="text-lg text-primary">Kelas</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 text-sm">
              <p>
                Nama: <Link href={`/guru/classes/${assessment.class.id}`} className="underline">{assessment.class.name}</Link>
              </p>
              <p className="text-muted-foreground">
                Durasi: {assessment.durationMinutes > 0 ? `${assessment.durationMinutes} menit` : "Tanpa batas"}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}
