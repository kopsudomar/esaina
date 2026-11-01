import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { ClassesManager } from "./classes-manager";

export const metadata = { title: "Kelas — ESAINA" };

export default async function ClassesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN") redirect("/guru");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-primary">Kelas</h1>
        <p className="text-sm text-muted-foreground">
          Buat kelas, bagikan kode gabung, dan kelola anggota.
        </p>
      </div>
      <ClassesManager />
    </main>
  );
}
