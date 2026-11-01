import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft } from "lucide-react";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/prisma";
import { AssessmentStatusBadge } from "@/components/assessment-status-badge";
import { Button } from "@/components/ui/button";
import { PublicationPanel } from "@/app/guru/publication-panel";

type Props = { params: Promise<{ id: string }> };

export default async function PublicationPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN") redirect("/guru");
  const { id } = await params;

  const assessment = await prisma.assessment.findUnique({
    where: { id },
    select: { title: true, status: true, class: { select: { teacherId: true } } },
  });
  if (!assessment) notFound();
  if (assessment.class.teacherId !== session.user.id && session.user.role !== "ADMIN") notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/guru/assessments/${id}`}>
            <ArrowLeft className="size-4" aria-hidden /> Kembali ke detail asesmen
          </Link>
        </Button>
      </div>
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-3xl font-semibold text-primary">{assessment.title}</h1>
        <AssessmentStatusBadge status={assessment.status} />
      </header>
      <PublicationPanel assessmentId={id} />
    </main>
  );
}
