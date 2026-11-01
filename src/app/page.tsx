import Image from "next/image";
import Link from "next/link";
import { getServerSession } from "next-auth";
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  PenLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { authOptions } from "@/lib/auth/config";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ROLES = [
  {
    icon: ClipboardCheck,
    title: "Guru",
    body: "Menilai esai dengan saran skor per kriteria, mengesahkan, lalu menerbitkan hasil.",
  },
  {
    icon: PenLine,
    title: "Siswa",
    body: "Mengerjakan esai dengan simpan otomatis dan melihat hasil yang sudah diterbitkan.",
  },
  {
    icon: ShieldCheck,
    title: "Admin",
    body: "Mengelola akun pengguna dan memantau progres penilaian sekolah.",
  },
];

const STEPS = [
  {
    title: "AI menyiapkan draf",
    body: "Untuk setiap kriteria, sistem mengusulkan skor, alasan, kutipan dari jawaban, dan draf feedback.",
  },
  {
    title: "Guru memutuskan",
    body: "Guru memakai, menyunting, atau menolak saran. Nilai final hanya sah setelah guru mengesahkannya.",
  },
  {
    title: "Siswa melihat hasil",
    body: "Siswa hanya melihat hasil setelah guru menerbitkannya; versi lama tetap tampil sampai revisi terbit.",
  },
];

const TRUST = [
  "Skor dihitung di server",
  "Jawaban dianonimkan ke AI",
  "Siswa hanya lihat hasil terbit",
];

export default async function Home() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const workspaceHref =
    user?.role === "TEACHER" ? "/guru" : user?.role === "ADMIN" ? "/admin" : "/siswa";
  const workspaceLabel =
    user?.role === "TEACHER"
      ? "Ruang kerja guru"
      : user?.role === "ADMIN"
        ? "Konsol admin"
        : "Daftar asesmen";
  const ctaHref = user ? workspaceHref : "/login";
  const ctaLabel = user ? workspaceLabel : "Masuk";

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col overflow-x-clip px-4 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-[var(--neu-radius-control)] bg-[var(--neu-surface-soft)] shadow-[var(--neu-shadow-raised-sm)]">
            <Image src="/logo-mark.png" alt="" aria-hidden width={20} height={20} className="size-5 object-contain" />
          </span>
          <span className="flex flex-col">
            <span className="font-heading text-lg font-bold leading-tight tracking-tight text-primary">ESAINA</span>
            <span className="text-xs text-muted-foreground">Penilaian esai</span>
          </span>
        </Link>
        <Button asChild variant="solid">
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      </header>

      <main className="flex flex-1 flex-col gap-16 pb-16">
        <section className="relative isolate flex flex-col gap-6 py-12 sm:py-20">
          <div className="relative z-10 flex flex-col gap-6">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-[var(--neu-surface-soft)] px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5 text-[var(--neu-accent-ink)]" aria-hidden />
              AI menyiapkan draf, guru yang memutuskan
            </span>
            <h1 className="max-w-2xl text-4xl font-bold leading-[1.12] tracking-tight text-primary sm:text-5xl lg:text-6xl">
              Penilaian esai yang bisa{" "}
              <span className="text-[var(--neu-accent-ink)]">dijelaskan</span>
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
              AI menyiapkan draf skor beserta alasan dan kutipan dari jawaban siswa. Guru memutuskan,
              dan siswa melihat hasil yang sudah diterbitkan.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg" variant="solid">
                <Link href={ctaHref}>{ctaLabel}</Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link href="#alur">
                  Lihat alur
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-sm text-muted-foreground">
              {TRUST.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check className="size-4 text-[var(--success)]" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="peran-heading" className="flex flex-col gap-6">
          <h2 id="peran-heading" className="text-2xl font-semibold tracking-tight text-primary">
            Siapa memakai apa
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {ROLES.map((role) => (
              <Card key={role.title}>
                <CardHeader>
                  <span className="flex size-10 items-center justify-center rounded-[var(--neu-radius-control)] bg-[var(--neu-surface-soft)] shadow-[var(--neu-shadow-raised-sm)]">
                    <role.icon className="size-5 text-[var(--neu-accent-ink)]" aria-hidden />
                  </span>
                  <CardTitle>{role.title}</CardTitle>
                  <CardDescription>{role.body}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section id="alur" aria-labelledby="alur-heading" className="flex scroll-mt-24 flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 id="alur-heading" className="text-2xl font-semibold tracking-tight text-primary">
              Alur penilaian
            </h2>
            <p className="text-muted-foreground">Tiga langkah dari jawaban siswa sampai hasil terbit.</p>
          </div>
          <ol className="grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="relative flex flex-col gap-3 rounded-[var(--neu-radius-surface)] border border-border bg-[var(--neu-surface-soft)] p-5">
                <span aria-hidden className="flex size-8 items-center justify-center rounded-full bg-primary [background-image:var(--neu-fill-primary)] text-sm font-semibold text-primary-foreground shadow-[var(--neu-shadow-raised-sm)]">
                  {index + 1}
                </span>
                <h3 className="font-semibold text-primary">
                  <span className="sr-only">Langkah {index + 1}: </span>
                  {step.title}
                </h3>
                <p className="leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <Card variant="accent">
          <CardHeader className="gap-y-3">
            <CardTitle className="text-xl">Siap menilai dengan bukti?</CardTitle>
            <CardDescription>Masuk dengan akun sekolah Anda. Guru tetap pemegang keputusan akhir.</CardDescription>
            <div className="pt-2">
              <Button asChild variant="soft">
                <Link href={ctaHref}>{ctaLabel}</Link>
              </Button>
            </div>
          </CardHeader>
        </Card>
      </main>

      <footer className="border-t border-border py-6 text-xs text-muted-foreground">
        ESAINA · Tim Kopsudomar · INCEPTION 2026
      </footer>
    </div>
  );
}
