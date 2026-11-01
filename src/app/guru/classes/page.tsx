import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { ClassList } from "../class-list";

export const metadata = { title: "Kelas — ESAINA" };

export default async function ClassesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN") redirect("/guru");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <ClassList />
    </main>
  );
}
