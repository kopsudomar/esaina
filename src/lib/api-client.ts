export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "HttpError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      signal: init?.signal ?? AbortSignal.timeout(45_000),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError")
    ) {
      throw new HttpError(408, "timeout", "Permintaan melebihi batas waktu.");
    }
    throw error;
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    const body = (data ?? {}) as { error?: string; message?: string; details?: unknown };
    throw new HttpError(res.status, body.error ?? "error", body.message ?? "Permintaan gagal.", body.details);
  }
  return data as T;
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) }),
  del: <T = null>(url: string) => request<T>(url, { method: "DELETE" }),
};
