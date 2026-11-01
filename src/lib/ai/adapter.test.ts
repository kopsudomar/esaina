import { afterEach, expect, it, vi } from "vitest";
import { createLlmAdapter } from "./adapter";

afterEach(() => vi.unstubAllGlobals());

it("mengulang tanpa response_format setelah 400 lalu parse JSON", async () => {
  process.env.LLM_API_KEY = "k";
  process.env.LLM_MODEL = "m";
  delete process.env.LLM_BASE_URL;
  const bodies: string[] = [];
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    bodies.push(String(init.body));
    if (bodies.length === 1) return new Response("no", { status: 400 });
    return Response.json({ choices: [{ message: { content: '```json\n{"items":[]}\n```' } }] });
  });
  vi.stubGlobal("fetch", fetchMock);

  const out = await createLlmAdapter().complete({ system: "s", user: "u" });

  expect(bodies[0]).toContain("response_format");
  expect(bodies[1]).not.toContain("response_format");
  expect(JSON.parse(out)).toEqual({ items: [] });
});

it("menyertakan status dan potongan body pada error HTTP", async () => {
  process.env.LLM_API_KEY = "k";
  process.env.LLM_MODEL = "m";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("quota exceeded for model", { status: 429 }))
  );

  await expect(createLlmAdapter().complete({ system: "s", user: "u" })).rejects.toThrow(
    "LLM HTTP 429: quota exceeded for model"
  );
});

it("memotong body error menjadi 300 karakter", async () => {
  process.env.LLM_API_KEY = "k";
  process.env.LLM_MODEL = "m";
  vi.stubGlobal("fetch", vi.fn(async () => new Response("x".repeat(500), { status: 500 })));

  await expect(createLlmAdapter().complete({ system: "s", user: "u" })).rejects.toThrow(
    `LLM HTTP 500: ${"x".repeat(300)}`
  );
});

it("menambah /openai pada base URL googleapis dan mengirim max_tokens", async () => {
  process.env.LLM_API_KEY = "k";
  process.env.LLM_MODEL = "gemini-2.5-flash";
  process.env.LLM_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/";
  const urls: string[] = [];
  const bodies: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      urls.push(url);
      bodies.push(String(init.body));
      return Response.json({ choices: [{ message: { content: "{}" }, finish_reason: "stop" }] });
    }),
  );

  await createLlmAdapter().complete({ system: "s", user: "u" });

  expect(urls[0]).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
  const body = JSON.parse(bodies[0]);
  expect(body.max_tokens).toBe(8192);
  expect(body.reasoning_effort).toBe("low");
});

it("tidak mengirim reasoning_effort dan memakai max_tokens 4096 untuk non-googleapis", async () => {
  process.env.LLM_API_KEY = "k";
  process.env.LLM_MODEL = "m";
  process.env.LLM_BASE_URL = "https://api.example.com/v1/";
  const bodies: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(String(init.body));
      return Response.json({ choices: [{ message: { content: "{}" }, finish_reason: "stop" }] });
    }),
  );

  await createLlmAdapter().complete({ system: "s", user: "u" });

  const body = JSON.parse(bodies[0]);
  expect(body.max_tokens).toBe(4096);
  expect(body).not.toHaveProperty("reasoning_effort");
});

it("tidak mengubah base URL non-googleapis", async () => {
  process.env.LLM_API_KEY = "k";
  process.env.LLM_MODEL = "m";
  process.env.LLM_BASE_URL = "https://api.example.com/v1/";
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      urls.push(url);
      return Response.json({ choices: [{ message: { content: "{}" }, finish_reason: "stop" }] });
    }),
  );

  await createLlmAdapter().complete({ system: "s", user: "u" });

  expect(urls[0]).toBe("https://api.example.com/v1/chat/completions");
});

it("melempar error jelas saat finish_reason length", async () => {
  process.env.LLM_API_KEY = "k";
  process.env.LLM_MODEL = "m";
  delete process.env.LLM_BASE_URL;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ choices: [{ message: { content: '{"items":[' }, finish_reason: "length" }] }),
    ),
  );

  await expect(createLlmAdapter().complete({ system: "s", user: "u" })).rejects.toThrow(
    "Respons LLM terpotong atau kosong (finish_reason: length).",
  );
});

it("melempar error jelas saat content kosong", async () => {
  process.env.LLM_API_KEY = "k";
  process.env.LLM_MODEL = "m";
  delete process.env.LLM_BASE_URL;
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ choices: [{ message: { content: "" } }] })));

  await expect(createLlmAdapter().complete({ system: "s", user: "u" })).rejects.toThrow(
    "Respons LLM terpotong atau kosong (finish_reason: tidak ada).",
  );
});
