"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, HttpError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function JoinForm() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [pending, setPending] = useState(false);
  const [joined, setJoined] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setJoined(null);
    try {
      const data = await api.post<{ name: string }>("/api/classes/join", { joinCode });
      setJoined(data.name);
      setJoinCode("");
      router.refresh();
    } catch (e) {
      setError(e instanceof HttpError ? e.message : "Gagal bergabung. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        noValidate
      >
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="joinCode">Kode kelas</Label>
          <Input
            id="joinCode"
            name="joinCode"
            required
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            disabled={pending}
            placeholder="Contoh: XIIA01"
            className="uppercase tracking-widest"
          />
        </div>
        <Button type="submit" variant="solid" disabled={pending}>
          {pending ? "Bergabung…" : "Gabung"}
        </Button>
      </form>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Gagal bergabung</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {joined ? (
        <Alert variant="success">
          <AlertTitle>Berhasil bergabung</AlertTitle>
          <AlertDescription>Anda sekarang anggota kelas {joined}.</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
