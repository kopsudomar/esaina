"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, HttpError } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Criterion = {
  id: string;
  code: string;
  description: string;
  minScore: number;
  maxScore: number;
};

type Question = {
  id: string;
  order: number;
  text: string;
  referenceAnswer: string;
  criteria: Criterion[];
};

type Revision = {
  id: string;
  version: number;
  status: string;
  totalScore: number;
  publications: { id: string }[];
  items: {
    questionId: string;
    criterionId: string;
    score: number | null;
    feedback: string;
  }[];
};

type Detail = {
  id: string;
  version: number;
  student: { anonCode: string };
  assessment: { title: string; questions: Question[] };
  answers: { questionId: string; content: string }[];
  gradeRevisions: Revision[];
};

type Item = {
  questionId: string;
  criterionId: string;
  score: number | null;
  feedback: string;
};

type AiPayload = { id: string; payload: unknown };

function errorMessage(error: unknown, fallback: string) {
  return error instanceof HttpError ? error.message : fallback;
}

export function GradingDetail({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const query = useQuery({
    queryKey: ["submission", submissionId],
    queryFn: () => api.get<Detail>(`/api/submissions/${submissionId}`),
  });
  const revision = query.data?.gradeRevisions[0];
  const [items, setItems] = useState<Item[]>([]);

  const currentItems =
    items.length > 0
      ? items
      : (revision?.items ??
        query.data?.assessment.questions.flatMap((q) =>
          q.criteria.map((c) => ({
            questionId: q.id,
            criterionId: c.id,
            score: null,
            feedback: "",
          })),
        ) ??
        []);

  const save = useMutation({
    mutationFn: () =>
      api.put(`/api/submissions/${submissionId}/grade`, {
        version: query.data?.version,
        items: currentItems,
      }),
    onSuccess: () => void query.refetch(),
  });

  const finalize = useMutation({
    mutationFn: () =>
      api.post<{ nextSubmissionId: string | null }>(
        `/api/submissions/${submissionId}/grade/finalize`,
      ),
    onSuccess: (data) => {
      if (data.nextSubmissionId) {
        router.push(`/guru/submissions/${data.nextSubmissionId}/grade`);
      } else {
        void query.refetch();
      }
    },
  });

  const revise = useMutation({
    mutationFn: () =>
      api.post(`/api/submissions/${submissionId}/grade/revise`),
    onSuccess: () => void query.refetch(),
  });

  const ai = useMutation({
    mutationFn: () =>
      api.post<{ aiResult: AiPayload; cached: boolean }>(
        `/api/submissions/${submissionId}/ai`,
      ),
    onMutate: () => applyAi.reset(),
    onSuccess: (data) => applyAi.mutate(data.aiResult.id),
  });

  const applyAi = useMutation({
    mutationFn: (aiResultId: string) =>
      api.post(`/api/submissions/${submissionId}/ai/apply`, {
        aiResultId,
        version: query.data?.version,
      }),
    onSuccess: () => {
      setItems([]);
      void query.refetch();
    },
  });

  if (query.isPending) {
    return (
      <p role="status" className="text-sm text-[var(--muted-foreground)]">
        Memuat LJK…
      </p>
    );
  }

  if (query.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex flex-col items-start gap-2">
          <p>{query.error.message}</p>
          <Button
            size="sm"
            variant="soft"
            onClick={() => void query.refetch()}
          >
            Coba lagi
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const detail = query.data;
  const answer = new Map(detail.answers.map((a) => [a.questionId, a.content]));
  const update = (criterionId: string, patch: Partial<Item>) =>
    setItems((all) =>
      (all.length ? all : currentItems).map((x) =>
        x.criterionId === criterionId ? { ...x, ...patch } : x,
      ),
    );
  const total = currentItems.reduce((sum, x) => sum + (x.score ?? 0), 0);
  const maxTotal = detail.assessment.questions.reduce(
    (sum, q) => sum + q.criteria.reduce((cs, c) => cs + c.maxScore, 0),
    0,
  );
  const unfilled = currentItems.filter((x) => x.score === null).length;
  const final = revision?.status === "FINAL";
  const published = Boolean(revision?.publications.length);
  const hasUnpublishedChanges = final && !published;
  const aiBusy = ai.isPending || applyAi.isPending;
  const aiError = applyAi.error ?? ai.error;
  const mutationError =
    [save.error, finalize.error, revise.error].find(Boolean) ?? aiError;

  const revisionBadge = published ? (
    <Badge variant="success">Terbit</Badge>
  ) : final ? (
    <Badge variant="primary">Dinilai Final</Badge>
  ) : (
    <Badge variant="soft">Draf</Badge>
  );

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Kode anonim
            </p>
            <h1 className="text-2xl font-semibold text-[var(--primary)]">
              {detail.assessment.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-[var(--muted-foreground)]">
                {detail.student.anonCode}
              </span>
              {revisionBadge}
            </div>
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
              Total skor
            </p>
            <p className="text-3xl font-semibold tabular-nums">{total}</p>
            <p className="text-xs text-[var(--muted-foreground)]">
              dari {maxTotal}
            </p>
          </div>
        </CardContent>
      </Card>

      {hasUnpublishedChanges ? (
        <Alert role="status">
          <AlertDescription>
            Perubahan belum diterbitkan. Siswa masih melihat versi terbit
            sebelumnya sampai Anda menerbitkan ulang.
          </AlertDescription>
        </Alert>
      ) : null}

      {detail.assessment.questions.map((q) => (
        <section className="grid gap-4 lg:grid-cols-2" key={q.id}>
          <Card>
            <CardHeader>
              <CardTitle>
                {q.order}. {q.text}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="whitespace-pre-wrap text-sm">
                {answer.get(q.id) || (
                  <span className="text-[var(--muted-foreground)]">
                    (kosong)
                  </span>
                )}
              </p>
              <details>
                <summary className="cursor-pointer text-sm text-[var(--muted-foreground)]">
                  Lihat jawaban acuan
                </summary>
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                  {q.referenceAnswer}
                </p>
              </details>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wide text-[var(--muted-foreground)]">
                Penilaian kriteria
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {q.criteria.map((c) => {
                const item = currentItems.find(
                  (x) => x.criterionId === c.id,
                );
                const score = item?.score ?? null;
                const outOfRange =
                  score !== null &&
                  (score < c.minScore || score > c.maxScore);
                const feedbackId = `feedback-${c.id}`;
                return (
                  <div className="flex flex-col gap-2" key={c.id}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium">
                        {c.code} · {c.description}
                      </p>
                      <span className="text-xs tabular-nums text-[var(--muted-foreground)]">
                        {c.minScore}–{c.maxScore}
                      </span>
                    </div>
                    <Label htmlFor={feedbackId} className="text-xs">
                      Feedback
                    </Label>
                    <Textarea
                      id={feedbackId}
                      disabled={final}
                      value={item?.feedback ?? ""}
                      onChange={(e) =>
                        update(c.id, { feedback: e.target.value })
                      }
                      placeholder="Feedback untuk kriteria ini…"
                      rows={2}
                    />
                    <Label htmlFor={`score-${c.id}`} className="text-xs">
                      Skor
                    </Label>
                    <Input
                      id={`score-${c.id}`}
                      disabled={final}
                      type="number"
                      min={c.minScore}
                      max={c.maxScore}
                      value={score ?? ""}
                      onChange={(e) =>
                        update(c.id, {
                          score:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        })
                      }
                      aria-label={`Skor ${c.code}`}
                      aria-invalid={outOfRange || undefined}
                      className="sm:max-w-32"
                    />
                    {outOfRange ? (
                      <p className="text-xs text-[var(--neu-error-text)]">
                        Skor harus {c.minScore}–{c.maxScore}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>
      ))}

      <div className="sticky bottom-0 z-10 mt-2 flex flex-col gap-2 border-t border-[color:var(--border)] bg-[var(--background)]/95 px-1 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5 text-sm">
          <span className="font-medium tabular-nums">
            Total {total} dari {maxTotal}
          </span>
          <span className="text-xs text-[var(--muted-foreground)]">
            {finalize.isPending
              ? "Mengesahkan…"
              : save.isPending
                ? "Menyimpan draf…"
                : unfilled > 0
                  ? `${unfilled} kriteria belum diberi skor.`
                  : final
                    ? "Nilai sudah disahkan"
                    : "Draf belum disahkan"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="soft"
            disabled={final || aiBusy}
            onClick={() => ai.mutate()}
          >
            {aiBusy ? "Menyiapkan saran AI…" : "Sarankan skor AI"}
          </Button>
          {final ? (
            <Button
              type="button"
              variant="soft"
              disabled={revise.isPending}
              onClick={() => revise.mutate()}
            >
              {revise.isPending ? "Membuka revisi…" : "Buka revisi"}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="soft"
            disabled={final || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Menyimpan…" : "Simpan draf"}
          </Button>
          <Button
            type="button"
            variant="solid"
            disabled={final || finalize.isPending || unfilled > 0}
            onClick={() => finalize.mutate()}
          >
            {finalize.isPending
              ? "Mengesahkan…"
              : final
                ? "Sudah final"
                : "Sahkan & siswa berikutnya"}
          </Button>
        </div>
      </div>

      {finalize.isSuccess && finalize.data?.nextSubmissionId ? (
        <p role="status" className="text-sm text-[var(--muted-foreground)]">
          Beralih ke LJK berikutnya…
        </p>
      ) : null}

      {applyAi.isSuccess && !mutationError ? (
        <p role="status" className="text-sm text-[var(--muted-foreground)]">
          Saran AI diterapkan. Periksa dan sesuaikan skor.
        </p>
      ) : null}

      {mutationError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {errorMessage(
              mutationError,
              mutationError === aiError
                ? "Saran AI gagal. Nilai manual tetap bisa dipakai."
                : "Gagal menyimpan nilai.",
            )}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
