"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Assessment = {
  id: string;
  title: string;
  instruction: string;
  class: { id: string; name: string };
  questionCount: number;
  durationMinutes: number;
  submission: { status: string; version: number; submittedAt: string | null } | null;
};

// `expiredIds` dihitung server: endpoint /mine tidak mengirim openedAt.
export function AssessmentList({ expiredIds = [] }: { expiredIds?: string[] }) {
  const query = useQuery({
    queryKey: ["my-assessments"],
    queryFn: () => api.get<{ assessments: Assessment[] }>("/api/assessments/mine"),
  });

  if (query.isPending) {
    return (
      <p
        className="text-sm text-muted-foreground"
        role="status"
      >
        Memuat asesmen…
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

  if (query.data.assessments.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Belum ada asesmen terbuka"
        description="Asesmen yang dibuka guru akan muncul di sini."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Asesmen</TableHead>
          <TableHead>Soal</TableHead>
          <TableHead>Batas waktu</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Aksi</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {query.data.assessments.map((a) => {
          const submitted = a.submission?.status === "SUBMITTED";
          const expired = expiredIds.includes(a.id);
          return (
            <TableRow key={a.id}>
              <TableCell>
                <p className="font-medium text-primary">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.class.name}</p>
              </TableCell>
              <TableCell className="tabular-nums">{a.questionCount}</TableCell>
              <TableCell>
                {a.durationMinutes === 0 ? "Tanpa batas" : `${a.durationMinutes} menit`}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1">
                  <Badge
                    variant={submitted ? "success" : a.submission ? "warning" : "soft"}
                  >
                    {submitted ? "Dikumpulkan" : a.submission ? "Draf" : "Belum dimulai"}
                  </Badge>
                  {expired && !submitted ? <Badge variant="destructive">Waktu habis</Badge> : null}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  asChild
                  size="sm"
                  variant={submitted ? "soft" : "solid"}
                >
                  <Link href={`/siswa/assessment/${a.id}`}>
                    {submitted ? "Lihat" : "Kerjakan"}
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
