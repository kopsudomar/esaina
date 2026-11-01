"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type Kelas = {
  id: string;
  name: string;
  joinCode: string;
  memberCount: number;
  assessmentCount: number;
};

export function ClassList() {
  const qc = useQueryClient();
  const classesQuery = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get<{ classes: Kelas[] }>("/api/classes"),
  });

  return (
    <section className="flex flex-col gap-4" aria-labelledby="kelas-heading">
      <div className="flex items-center justify-between gap-4">
        <h2 id="kelas-heading" className="text-2xl font-semibold text-primary">
          Kelas saya
        </h2>
        <CreateClassDialog onCreated={() => void qc.invalidateQueries({ queryKey: ["classes"] })} />
      </div>

      {classesQuery.isPending ? (
        <p className="text-sm text-muted-foreground" role="status">
          Memuat kelas…
        </p>
      ) : null}

      {classesQuery.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>
              {classesQuery.error instanceof Error ? classesQuery.error.message : "Gagal memuat kelas."}
            </span>
            <Button size="sm" variant="soft" onClick={() => void classesQuery.refetch()}>
              Coba lagi
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {classesQuery.data?.classes.length === 0 ? (
        <Card className="items-center px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Belum ada kelas. Buat kelas pertama untuk mulai menyusun asesmen.
          </p>
        </Card>
      ) : null}

      {classesQuery.data && classesQuery.data.classes.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {classesQuery.data.classes.map((k) => (
            <li key={k.id}>
              <Card className="gap-3 px-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-medium text-primary">{k.name}</h3>
                  <Badge variant="soft">Kode {k.joinCode}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {k.memberCount} anggota · {k.assessmentCount} asesmen
                </p>
                <div>
                  <Button asChild variant="soft" size="sm">
                    <Link href={`/guru/classes/${k.id}`}>Kelola kelas</Link>
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function CreateClassDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (name: string) => api.post<{ joinCode: string }>("/api/classes", { name }),
    onSuccess: (data) => {
      setCode(data.joinCode);
      onCreated();
    },
  });

  function reset() {
    setCode(null);
    create.reset();
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    create.mutate(String(form.get("name") ?? ""));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button variant="solid" />}>Buat kelas</DialogTrigger>
      <DialogContent>
        {code ? (
          <>
            <DialogHeader>
              <DialogTitle>Kelas dibuat</DialogTitle>
              <DialogDescription>Bagikan kode ini ke siswa untuk bergabung.</DialogDescription>
            </DialogHeader>
            <p className="text-center text-4xl font-semibold tracking-widest text-primary">{code}</p>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Selesai</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Buat kelas</DialogTitle>
              <DialogDescription>Masukkan nama kelas, lalu bagikan kode ke siswa.</DialogDescription>
            </DialogHeader>
            {create.isError ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>
                  {create.error instanceof Error ? create.error.message : "Gagal membuat kelas."}
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="class-name">Nama kelas</Label>
              <Input id="class-name" name="name" required disabled={create.isPending} placeholder="XII A" />
            </div>
            <DialogFooter>
              <Button type="submit" variant="solid" disabled={create.isPending}>
                {create.isPending ? "Menyimpan…" : "Buat kelas"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
