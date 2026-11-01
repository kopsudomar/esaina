"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Copy, RefreshCw, Users } from "lucide-react";
import { api, HttpError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Kelas = {
  id: string;
  name: string;
  joinCode: string;
  memberCount: number;
  assessmentCount: number;
};

type Student = { id: string; name: string; joinedAt: string };

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const isUnauthorized = (error: unknown) =>
  error instanceof HttpError && error.status === 401;

function SessionExpired() {
  return (
    <Alert variant="destructive">
      <AlertTriangle aria-hidden />
      <AlertTitle>Sesi kedaluwarsa</AlertTitle>
      <AlertDescription>
        <p>Masuk ulang untuk melanjutkan mengelola kelas.</p>
        <Button asChild size="sm" variant="soft" className="min-h-11">
          <a href="/login">Ke halaman masuk</a>
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export function ClassesManager() {
  const qc = useQueryClient();
  const classesQuery = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get<{ classes: Kelas[] }>("/api/classes"),
  });

  const [renaming, setRenaming] = useState<Kelas | null>(null);
  const [deleting, setDeleting] = useState<Kelas | null>(null);
  const [membersFor, setMembersFor] = useState<Kelas | null>(null);
  const [rotated, setRotated] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["classes"] });

  const rotate = useMutation({
    mutationFn: (id: string) =>
      api.patch<Kelas>(`/api/classes/${id}`, { rotateJoinCode: true }),
    onSuccess: (data) => {
      setRotated((prev) => ({ ...prev, [data.id]: data.joinCode }));
      setNotice(`Kode kelas ${data.name} berhasil diganti.`);
      invalidate();
    },
  });

  const rotateError = rotate.error;
  const rotateUnauthorized = isUnauthorized(rotateError);

  return (
    <div className="flex flex-col gap-6">
      <CreateClassForm onCreated={invalidate} />

      {notice ? (
        <Alert variant="success" aria-live="polite">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}

      {rotateError && !rotateUnauthorized ? (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden />
          <AlertDescription>
            {errorMessage(rotateError, "Gagal mengganti kode kelas.")}
          </AlertDescription>
        </Alert>
      ) : null}
      {rotateUnauthorized ? <SessionExpired /> : null}

      <section className="flex flex-col gap-3" aria-labelledby="daftar-kelas">
        <h2 id="daftar-kelas" className="text-2xl font-semibold text-primary">
          Daftar kelas
        </h2>

        {classesQuery.isPending ? (
          <div className="flex flex-col gap-3" role="status" aria-label="Memuat kelas">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <span className="text-sm text-muted-foreground">Memuat kelas…</span>
          </div>
        ) : null}

        {classesQuery.isError && !isUnauthorized(classesQuery.error) ? (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden />
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>{errorMessage(classesQuery.error, "Gagal memuat kelas.")}</span>
              <Button
                size="sm"
                variant="soft"
                className="min-h-11"
                onClick={() => void classesQuery.refetch()}
                disabled={classesQuery.isFetching}
              >
                {classesQuery.isFetching ? "Memuat…" : "Coba lagi"}
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {classesQuery.isError && isUnauthorized(classesQuery.error) ? <SessionExpired /> : null}

        {classesQuery.data && classesQuery.data.classes.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Belum ada kelas"
            description="Buat kelas pertama, lalu bagikan kode gabung ke siswa."
          />
        ) : null}

        {classesQuery.data && classesQuery.data.classes.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kelas</TableHead>
                <TableHead>Kode gabung</TableHead>
                <TableHead>Siswa</TableHead>
                <TableHead>Asesmen</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classesQuery.data.classes.map((k) => {
                const newCode = rotated[k.id];
                return (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono tabular-nums">{newCode ?? k.joinCode}</span>
                        <CopyCodeButton code={newCode ?? k.joinCode} name={k.name} />
                        {newCode ? <Badge variant="success">Kode baru</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell>{k.memberCount} siswa</TableCell>
                    <TableCell>{k.assessmentCount} asesmen</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="soft"
                          className="min-h-11"
                          onClick={() => setMembersFor(k)}
                        >
                          Anggota
                        </Button>
                        <Button
                          size="sm"
                          variant="soft"
                          className="min-h-11"
                          onClick={() => setRenaming(k)}
                        >
                          Ubah nama
                        </Button>
                        <Button
                          size="sm"
                          variant="soft"
                          className="min-h-11"
                          disabled={rotate.isPending}
                          onClick={() => {
                            setNotice(null);
                            rotate.mutate(k.id);
                          }}
                        >
                          <RefreshCw aria-hidden /> Ganti kode
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="min-h-11"
                          onClick={() => setDeleting(k)}
                        >
                          Hapus
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : null}
      </section>

      {renaming ? (
        <RenameDialog
          kelas={renaming}
          onClose={() => setRenaming(null)}
          onSaved={() => {
            setRenaming(null);
            invalidate();
          }}
        />
      ) : null}

      {deleting ? (
        <DeleteDialog
          kelas={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            setNotice(null);
            invalidate();
          }}
        />
      ) : null}

      {membersFor ? (
        <MembersDialog kelas={membersFor} onClose={() => setMembersFor(null)} />
      ) : null}
    </div>
  );
}

function CreateClassForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [created, setCreated] = useState<{ name: string; joinCode: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const create = useMutation({
    mutationFn: (className: string) =>
      api.post<{ id: string; name: string; joinCode: string }>("/api/classes", {
        name: className,
      }),
    onSuccess: (data) => {
      setCreated({ name: data.name, joinCode: data.joinCode });
      setName("");
      onCreated();
      inputRef.current?.focus();
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl text-primary">Buat kelas</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = name.trim();
            if (!trimmed) return;
            setCreated(null);
            create.mutate(trimmed);
          }}
        >
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="kelas-baru">Nama kelas</Label>
            <Input
              id="kelas-baru"
              ref={inputRef}
              value={name}
              maxLength={80}
              required
              disabled={create.isPending}
              placeholder="XII IPA 1"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <Button
            type="submit"
            variant="solid"
            size="lg"
            disabled={create.isPending || !name.trim()}
          >
            {create.isPending ? "Menyimpan…" : "Buat kelas"}
          </Button>
        </form>

        {create.isError && !isUnauthorized(create.error) ? (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden />
            <AlertDescription>
              {errorMessage(create.error, "Gagal membuat kelas.")}
            </AlertDescription>
          </Alert>
        ) : null}
        {create.isError && isUnauthorized(create.error) ? <SessionExpired /> : null}

        {created ? (
          <Alert variant="success" aria-live="polite">
            <AlertDescription>
              Kelas <strong>{created.name}</strong> dibuat. Kode gabung:{" "}
              <span className="font-mono font-semibold tabular-nums">{created.joinCode}</span>
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RenameDialog({
  kelas,
  onClose,
  onSaved,
}: {
  kelas: Kelas;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(kelas.name);

  const rename = useMutation({
    mutationFn: (nextName: string) =>
      api.patch<Kelas>(`/api/classes/${kelas.id}`, { name: nextName }),
    onSuccess: onSaved,
  });

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = name.trim();
            if (!trimmed || trimmed === kelas.name) return;
            rename.mutate(trimmed);
          }}
        >
          <DialogHeader>
            <DialogTitle>Ubah nama kelas</DialogTitle>
            <DialogDescription>Nama baru langsung terlihat oleh siswa.</DialogDescription>
          </DialogHeader>

          {rename.isError && !isUnauthorized(rename.error) ? (
            <Alert variant="destructive">
              <AlertTriangle aria-hidden />
              <AlertDescription>
                {errorMessage(rename.error, "Gagal mengubah nama kelas.")}
              </AlertDescription>
            </Alert>
          ) : null}
          {rename.isError && isUnauthorized(rename.error) ? <SessionExpired /> : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="kelas-nama">Nama kelas</Label>
            <Input
              id="kelas-nama"
              value={name}
              maxLength={80}
              required
              disabled={rename.isPending}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" className="min-h-11" onClick={onClose}>
              Batal
            </Button>
            <Button
              type="submit"
              variant="solid"
              className="min-h-11"
              disabled={rename.isPending || !name.trim() || name.trim() === kelas.name}
            >
              {rename.isPending ? "Menyimpan…" : "Simpan nama"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  kelas,
  onClose,
  onDeleted,
}: {
  kelas: Kelas;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirmation, setConfirmation] = useState("");

  const remove = useMutation({
    mutationFn: () => api.del(`/api/classes/${kelas.id}`),
    onSuccess: onDeleted,
  });

  const conflict =
    remove.error instanceof HttpError && remove.error.status === 409
      ? remove.error
      : null;
  const unauthorized = isUnauthorized(remove.error);
  const matches = confirmation.trim() === kelas.name;

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hapus kelas</DialogTitle>
          <DialogDescription>
            Kelas <strong>{kelas.name}</strong> akan dihapus permanen. Tindakan ini tidak bisa
            dibatalkan.
          </DialogDescription>
        </DialogHeader>

        {conflict ? (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden />
            <AlertTitle>Kelas tidak bisa dihapus</AlertTitle>
            <AlertDescription>
              <p>
                {conflict.message ||
                  "Kelas masih punya asesmen. Hapus asesmen terlebih dahulu."}
              </p>
              <p>Hapus asesmen kelas ini dulu, lalu coba lagi.</p>
            </AlertDescription>
          </Alert>
        ) : null}

        {remove.isError && !conflict && !unauthorized ? (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden />
            <AlertDescription>
              {errorMessage(remove.error, "Gagal menghapus kelas.")}
            </AlertDescription>
          </Alert>
        ) : null}
        {unauthorized ? <SessionExpired /> : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="kelas-konfirmasi">
            Ketik <span className="font-semibold">{kelas.name}</span> untuk konfirmasi
          </Label>
          <Input
            id="kelas-konfirmasi"
            value={confirmation}
            autoComplete="off"
            disabled={remove.isPending || unauthorized}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" className="min-h-11" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="destructive"
            className="min-h-11"
            disabled={!matches || remove.isPending || unauthorized}
            onClick={() => remove.mutate()}
          >
            {remove.isPending ? "Menghapus…" : "Hapus kelas permanen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MembersDialog({ kelas, onClose }: { kelas: Kelas; onClose: () => void }) {
  const membersQuery = useQuery({
    queryKey: ["classes", kelas.id, "members"],
    queryFn: () => api.get<{ students: Student[] }>(`/api/classes/${kelas.id}/members`),
  });

  const unauthorized = isUnauthorized(membersQuery.error);

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anggota {kelas.name}</DialogTitle>
          <DialogDescription>
            {kelas.memberCount} siswa terdaftar dengan kode {kelas.joinCode}.
          </DialogDescription>
        </DialogHeader>

        {membersQuery.isPending ? (
          <div className="flex flex-col gap-2" role="status">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <span className="text-sm text-muted-foreground">Memuat anggota…</span>
          </div>
        ) : null}

        {membersQuery.isError && !unauthorized ? (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden />
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>{errorMessage(membersQuery.error, "Gagal memuat anggota.")}</span>
              <Button
                size="sm"
                variant="soft"
                className="min-h-11"
                onClick={() => void membersQuery.refetch()}
                disabled={membersQuery.isFetching}
              >
                {membersQuery.isFetching ? "Memuat…" : "Coba lagi"}
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
        {unauthorized ? <SessionExpired /> : null}

        {membersQuery.data && membersQuery.data.students.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada siswa bergabung. Bagikan kode gabung {kelas.joinCode}.
          </p>
        ) : null}

        {membersQuery.data && membersQuery.data.students.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Tanggal gabung</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {membersQuery.data.students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">{student.name}</TableCell>
                  <TableCell>
                    <time dateTime={student.joinedAt}>{formatDate(student.joinedAt)}</time>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}

        <DialogFooter>
          <Button variant="soft" className="min-h-11" onClick={onClose}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CopyCodeButton({ code, name }: { code: string; name: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        size="sm"
        variant="ghost"
        className="min-h-11"
        aria-label={`Salin kode kelas ${name}`}
        onClick={() => void copy()}
      >
        <Copy aria-hidden /> Salin
      </Button>
      <span aria-live="polite" className="text-xs text-muted-foreground">
        {status === "copied" ? "Tersalin" : null}
        {status === "failed" ? "Gagal menyalin, salin manual." : null}
      </span>
    </span>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
