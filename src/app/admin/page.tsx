import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ClipboardList, FileText, GraduationCap, ShieldCheck, UserCheck, Users } from "lucide-react";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";

export const metadata = { title: "Beranda admin — ESAINA" };

export default async function AdminHome() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect(session.user.role === "TEACHER" ? "/guru" : "/siswa");

  const [teachers, students, admins, active, assessments, submissions] = await Promise.all([
    prisma.user.count({ where: { role: "TEACHER" } }),
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.assessment.count(),
    prisma.submission.count({ where: { status: "SUBMITTED" } }),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-primary">Beranda admin</h1>
        <p className="text-sm text-muted-foreground">Halo, {session.user.name}. Ringkasan penggunaan platform ESAINA.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Guru" value={teachers} icon={Users} />
        <StatCard label="Siswa" value={students} icon={GraduationCap} />
        <StatCard label="Admin" value={admins} icon={ShieldCheck} />
        <StatCard label="Pengguna aktif" value={active} icon={UserCheck} />
        <StatCard label="Asesmen" value={assessments} icon={FileText} />
        <StatCard label="LJK terkumpul" value={submissions} icon={ClipboardList} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-primary">Kelas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Lihat semua kelas lintas guru beserta jumlah anggota dan asesmennya.
            </p>
            <div>
              <Button asChild variant="soft" size="sm">
                <Link href="/admin/classes">Buka</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-primary">Asesmen</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Pantau seluruh asesmen lintas kelas beserta status dibuka, ditutup, dan draf.
            </p>
            <div>
              <Button asChild variant="soft" size="sm">
                <Link href="/admin/assessments">Buka</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-primary">Manajemen pengguna</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Kelola akun guru, siswa, dan admin beserta status aktifnya.
            </p>
            <div>
              <Button asChild variant="soft" size="sm">
                <Link href="/admin/users">Buka</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-primary">Monitoring asesmen</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Pantau jumlah LJK dan progres penilaian tiap asesmen guru.
            </p>
            <div>
              <Button asChild variant="soft" size="sm">
                <Link href="/admin/monitoring">Buka</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
