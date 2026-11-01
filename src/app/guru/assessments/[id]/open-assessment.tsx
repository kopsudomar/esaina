"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function OpenAssessment({ assessmentId, version }: { assessmentId: string; version: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const mut = useMutation({
    mutationFn: () => api.post(`/api/assessments/${assessmentId}/open`, { version }),
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="solid" />}>Buka asesmen</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buka asesmen?</DialogTitle>
          <DialogDescription>
            Setelah dibuka, soal dan rubrik terkunci dan tidak dapat diubah lagi. Siswa dapat mulai mengerjakan.
          </DialogDescription>
        </DialogHeader>
        {mut.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>
              {mut.error instanceof Error ? mut.error.message : "Gagal membuka asesmen."}
            </AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={mut.isPending}>
            Batal
          </Button>
          <Button variant="solid" onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Membuka…" : "Ya, buka asesmen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
