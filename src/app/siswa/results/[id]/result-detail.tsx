"use client";

import { useQuery } from "@tanstack/react-query";
import { Award } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

type Result = {
  assessment: { id: string; title: string };
  publishedAt: string;
  revision: {
    totalScore: number;
    items: {
      questionId: string;
      criterionId: string;
      score: number | null;
      feedback: string;
      criterion: { code: string; description: string };
    }[];
    submission: {
      assessment: {
        questions: {
          id: string;
          order: number;
          text: string;
          criteria: { id: string; code: string; maxScore: number }[];
        }[];
      };
    };
  };
};

export function ResultDetail({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ["result", id],
    queryFn: () => api.get<Result>(`/api/student/results/${id}`),
  });

  if (query.isPending) {
    return (
      <p
        className="text-sm text-muted-foreground"
        role="status"
      >
        Memuat hasil…
      </p>
    );
  }

  if (query.isError) {
    return (
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
    );
  }

  const { assessment, publishedAt, revision } = query.data;
  const maxTotal = revision.submission.assessment.questions
    .flatMap((q) => q.criteria)
    .reduce((sum, c) => sum + c.maxScore, 0);
  const gradedQuestions = revision.submission.assessment.questions
    .map((question) => ({
      question,
      items: revision.items.filter((i) => i.questionId === question.id),
    }))
    .filter((entry) => entry.items.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <h1 className="min-w-0 text-2xl font-semibold leading-7 tracking-tight text-primary [overflow-wrap:anywhere]">
            {assessment.title}
          </h1>
          <CardDescription>
            Terbit{" "}
            {new Date(publishedAt).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-1">
            <p className="text-4xl font-semibold tabular-nums text-primary">
              {revision.totalScore}
            </p>
            {maxTotal > 0 && (
              <p className="text-lg tabular-nums text-muted-foreground">/ {maxTotal}</p>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Total nilai</p>
        </CardContent>
      </Card>

      {gradedQuestions.length === 0 ? (
        <EmptyState
          icon={Award}
          title="Belum ada rincian penilaian"
          description="Rincian per soal akan tampil di sini setelah tersedia."
        />
      ) : (
        gradedQuestions.map(({ question, items }) => {
          const questionMax = question.criteria.reduce((s, c) => s + c.maxScore, 0);
          const questionTotal = items.reduce((s, i) => s + (i.score ?? 0), 0);
          return (
            <Card key={question.id}>
              <CardHeader>
                <CardTitle>Soal {question.order}</CardTitle>
                <CardDescription>{question.text}</CardDescription>
                {questionMax > 0 && (
                  <CardAction>
                    <Badge variant="soft">
                      {questionTotal}/{questionMax} poin
                    </Badge>
                  </CardAction>
                )}
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <ul className="flex flex-col gap-2">
                  {items.map((item) => (
                    <li
                      key={item.criterionId}
                      className="flex flex-col gap-1.5 rounded-[var(--neu-radius-small)] bg-[var(--neu-surface-soft)] px-3 py-2.5"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p className="text-sm font-medium text-[var(--foreground)]">
                          {item.criterion.code} · {item.criterion.description}
                        </p>
                        <p className="text-sm font-semibold tabular-nums text-primary">
                          {item.score === null ? "Belum dinilai" : `${item.score} poin`}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {item.feedback ? item.feedback : "Tidak ada catatan."}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
