"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Check, Timer } from "lucide-react";
import { api, HttpError } from "@/lib/api-client";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitDialog } from "./submit-dialog";

type Work = {
  assessment: {
    id: string;
    title: string;
    instruction: string;
    durationMinutes: number;
    openedAt: string | null;
    closedAt: string | null;
    questions: { id: string; order: number; text: string; maxScore: number }[];
  };
  submission: { id: string; version: number; status: string; answers: { questionId: string; content: string }[] };
};

type SaveState = "idle" | "saving" | "saved" | "failed" | "conflict";

const saveLabel: Record<SaveState, string> = {
  idle: "Draf",
  saving: "Menyimpan…",
  saved: "Tersimpan",
  failed: "Gagal simpan",
  conflict: "Konflik versi",
};

const saveVariant = {
  idle: "soft",
  saving: "soft",
  saved: "success",
  failed: "destructive",
  conflict: "warning",
} as const satisfies Record<SaveState, "soft" | "success" | "destructive" | "warning">;

const MAX_CHARS = 5000;
const WARN_SECONDS = 300;

function formatRemaining(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function StudentWork({ assessmentId }: { assessmentId: string }) {
  const query = useQuery({ queryKey: ["work", assessmentId], queryFn: () => api.get<Work>(`/api/assessments/${assessmentId}/work`) });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [version, setVersion] = useState(1);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialized = useRef(false);

  const submitted = query.data?.submission.status === "SUBMITTED";

  const deadline = useMemo(() => {
    const a = query.data?.assessment;
    if (!a || a.durationMinutes === 0 || !a.openedAt) return null;
    return new Date(a.openedAt).getTime() + a.durationMinutes * 60_000;
  }, [query.data]);

  useEffect(() => {
    if (!query.data || initialized.current) return;
    initialized.current = true;
    setVersion(query.data.submission.version);
    setAnswers(Object.fromEntries(query.data.submission.answers.map((a) => [a.questionId, a.content])));
  }, [query.data]);

  // Batas waktu dihitung dari data server; pengecekan closedAt dilakukan di efek.
  useEffect(() => {
    if (!deadline || submitted) return;
    const a = query.data?.assessment;
    if (a?.closedAt && new Date(a.closedAt).getTime() < Date.now()) return;
    const tick = () => {
      const left = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) clearInterval(interval);
    };
    const interval = setInterval(tick, 1000);
    const first = setTimeout(tick, 0);
    return () => {
      clearInterval(interval);
      clearTimeout(first);
    };
  }, [deadline, submitted, query.data]);

  function change(questionId: string, content: string) {
    setAnswers((current) => ({ ...current, [questionId]: content }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSaveState("saving");
      try {
        const result = await api.patch<{ version: number }>(`/api/assessments/${assessmentId}/work`, { version, questionId, content });
        setVersion(result.version);
        setSaveState("saved");
      } catch (e) {
        setSaveState(e instanceof HttpError && e.status === 409 ? "conflict" : "failed");
      }
    }, 1000);
  }

  if (query.isPending) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p role="status">Memuat lembar kerja…</p>
      </main>
    );
  }

  if (query.isError) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Alert variant="destructive">
          <AlertDescription className="flex flex-col items-start gap-2">
            <span>{query.error.message}</span>
            <Button
              size="sm"
              variant="soft"
              onClick={() => void query.refetch()}
            >
              Coba lagi
            </Button>
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  const { assessment } = query.data;
  const total = assessment.questions.length;
  const filled = assessment.questions.filter((q) => (answers[q.id] ?? "").trim().length > 0).length;
  const unanswered = total - filled;
  const isFilled = (questionId: string) => (answers[questionId] ?? "").trim().length > 0;
  const timeUp = remaining === 0 && !submitted;
  const idx = Math.min(currentIdx, Math.max(0, total - 1));
  const question = assessment.questions[idx];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Card>
        <CardHeader className="gap-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-semibold text-primary">{assessment.title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              {submitted ? (
                <Badge variant="success">Sudah dikumpulkan</Badge>
              ) : remaining !== null ? (
                <div aria-live={remaining < WARN_SECONDS ? "polite" : "off"}>
                  <Badge
                    variant={remaining < WARN_SECONDS ? "destructive" : "soft"}
                    className="tabular-nums"
                  >
                    <Timer aria-hidden />
                    {formatRemaining(remaining)}
                  </Badge>
                </div>
              ) : null}
              <div aria-live="polite" className="w-fit">
                <Badge variant={saveVariant[saveState]}>{saveLabel[saveState]}</Badge>
              </div>
            </div>
          </div>
          {assessment.instruction ? (
            <p className="text-sm text-muted-foreground">{assessment.instruction}</p>
          ) : null}
        </CardHeader>
      </Card>

      {timeUp ? (
        <Alert variant="destructive">
          <AlertDescription>
            Waktu habis. Kumpulkan jawaban Anda sekarang.
          </AlertDescription>
        </Alert>
      ) : null}

      {saveState === "conflict" ? (
        <Alert variant="destructive">
          <AlertDescription>
            Jawaban berubah di tab lain. Muat ulang halaman agar aman.
          </AlertDescription>
        </Alert>
      ) : null}

      <p
        className="text-sm text-muted-foreground"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={filled}
        aria-valuetext={`${filled} dari ${total} soal terisi`}
      >
        {filled} dari {total} soal terisi
      </p>

      <nav aria-label="Navigasi soal" className="flex flex-wrap gap-2">
        {assessment.questions.map((q, i) => {
          const done = isFilled(q.id);
          return (
            <Button
              key={q.id}
              size="sm"
              variant={i === idx ? "solid" : "soft"}
              aria-current={i === idx ? "step" : undefined}
              aria-label={`Soal ${i + 1}, ${done ? "sudah diisi" : "belum diisi"}`}
              onClick={() => setCurrentIdx(i)}
            >
              {i + 1}
              {done ? <Check aria-hidden /> : null}
            </Button>
          );
        })}
      </nav>

      {question ? (
        <Card>
          <CardHeader>
            <CardTitle>Soal {idx + 1}</CardTitle>
            <CardDescription className="text-foreground">{question.text}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Label htmlFor={`answer-${question.id}`}>Jawaban Anda</Label>
            <Textarea
              id={`answer-${question.id}`}
              value={answers[question.id] ?? ""}
              onChange={(e) => change(question.id, e.target.value)}
              placeholder="Tulis jawaban…"
              rows={7}
              maxLength={MAX_CHARS}
              disabled={submitted}
            />
            <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>{submitted ? "Jawaban sudah dikumpulkan." : "Tersimpan otomatis setelah Anda berhenti mengetik."}</p>
              <p className="tabular-nums sm:text-right">
                {(answers[question.id] ?? "").length} / {MAX_CHARS}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="soft"
          disabled={idx === 0}
          onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
        >
          Sebelumnya
        </Button>
        <p className="text-center text-sm text-muted-foreground" aria-live="polite">
          Soal {idx + 1} dari {total}
        </p>
        <Button
          variant="soft"
          disabled={idx >= total - 1}
          onClick={() => setCurrentIdx((i) => Math.min(total - 1, i + 1))}
        >
          Berikutnya
        </Button>
      </div>

      <div className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-[color:var(--border)] bg-[var(--background)]/95 px-1 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {saveState === "saving"
            ? "Menyimpan sebelum mengumpulkan…"
            : unanswered > 0
              ? `${unanswered} soal belum dijawab.`
              : "Semua soal sudah dijawab."}
        </p>
        {submitted ? (
          <Button asChild variant="soft" size="lg">
            <Link href="/siswa">Kembali ke beranda</Link>
          </Button>
        ) : (
          // Sengaja tidak auto-submit saat waktu habis: keputusan produk, siswa menekan sendiri.
          <SubmitDialog
            assessmentId={assessmentId}
            version={version}
            unanswered={unanswered}
          />
        )}
      </div>
    </main>
  );
}
