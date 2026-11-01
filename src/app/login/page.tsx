import Image from "next/image";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ShieldCheck, ScrollText } from "lucide-react";
import { authOptions } from "@/lib/auth/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata = { title: "Masuk — ESAINA" };

const POINTS = [
  {
    icon: ScrollText,
    title: "Penilaian transparan",
    body: "Setiap saran skor disertai alasan dan kutipan dari jawaban siswa.",
  },
  {
    icon: ShieldCheck,
    title: "Keputusan tetap di guru",
    body: "AI hanya menyiapkan draf. Nilai sah dan penerbitan selalu lewat guru.",
  },
];

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session?.user) redirect("/");

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-center gap-8 px-12 lg:flex">
        <div className="flex items-center gap-2">
          <Image src="/logo-mark.png" alt="" aria-hidden width={24} height={24} className="size-6 object-contain" />
          <span className="font-heading text-lg font-bold tracking-tight text-primary">
            ESAINA
          </span>
        </div>
        <h1 className="max-w-md text-3xl font-bold leading-tight tracking-tight text-primary">
          Masuk ke ESAINA
        </h1>
        <ul className="flex max-w-md flex-col gap-5">
          {POINTS.map((point) => (
            <li key={point.title} className="flex gap-3">
              <point.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-primary">{point.title}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{point.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <main className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader>
              <Image src="/logo-mark.png" alt="" aria-hidden width={24} height={24} className="size-6 object-contain lg:hidden" />
              <CardTitle className="text-2xl">Masuk ke ESAINA</CardTitle>
              <CardDescription>Gunakan akun yang diberikan sekolah.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <LoginForm />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Hubungi admin sekolah bila belum memiliki akun.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
