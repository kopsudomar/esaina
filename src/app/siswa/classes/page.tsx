import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { Users } from "lucide-react";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { JoinForm } from "./join-form";

export const metadata = { title: "Kelas saya — ESAINA" };

export default async function StudentClassesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "STUDENT") redirect(session.user.role === "ADMIN" ? "/admin" : "/guru");

  const memberships = await prisma.classMembership.findMany({
    where: { studentId: session.user.id },
    orderBy: { joinedAt: "desc" },
    include: {
      class: {
        include: {
          _count: { select: { memberships: true, assessments: true } },
          teacher: { select: { name: true } },
        },
      },
    },
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-primary">Kelas saya</h1>
        <p className="text-sm text-muted-foreground">Gabung kelas dengan kode dari guru, lalu kerjakan asesmen yang dibuka.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gabung kelas</CardTitle>
          <CardDescription>Masukkan kode gabung yang diberikan guru.</CardDescription>
        </CardHeader>
        <CardContent>
          <JoinForm />
        </CardContent>
      </Card>

      {memberships.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Belum mengikuti kelas"
          description="Masukkan kode gabung dari guru untuk mulai."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {memberships.map(({ class: k }) => (
            <Card key={k.id}>
              <CardHeader>
                <CardTitle>{k.name}</CardTitle>
                <CardDescription>Guru: {k.teacher.name}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  {k._count.memberships} anggota · {k._count.assessments} asesmen
                </p>
                <Button asChild variant="soft" size="sm" className="w-fit">
                  <Link href="/siswa">Lihat asesmen</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
