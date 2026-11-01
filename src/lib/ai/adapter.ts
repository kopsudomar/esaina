export type LlmCriterion = {
  id: string;
  code: string;
  description: string;
  minScore: number;
  maxScore: number;
};

export type LlmQuestion = {
  id: string;
  text: string;
  referenceAnswer: string;
  answer: string;
  criteria: LlmCriterion[];
};

export type AiGradeItem = {
  questionId: string;
  criterionId: string;
  score: number;
  evidence: string;
  rationale: string;
  feedback: string;
};

export type AiGradePayload = {
  items: AiGradeItem[];
};

export type LlmAdapter = {
  provider: string;
  model: string;
  complete(input: { system: string; user: string }): Promise<string>;
};

export function createLlmAdapter(): LlmAdapter {
  let baseUrl = (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  // Gemini native base URL harus lewat jalur kompatibel OpenAI agar /chat/completions valid.
  if (baseUrl.includes("generativelanguage.googleapis.com") && !baseUrl.includes("/openai")) {
    baseUrl += "/openai";
  }
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;
  if (!apiKey || !model) throw new Error("LLM belum dikonfigurasi.");
  const isGemini = baseUrl.includes("generativelanguage.googleapis.com");

  return {
    provider: process.env.LLM_PROVIDER ?? "openai-compatible",
    model,
    async complete(input) {
      const send = (jsonMode: boolean) =>
        fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            temperature: 0,
            // Gemini 2.5 menghitung token thinking dalam max_tokens; beri ruang + reasoning rendah.
            max_tokens: isGemini ? 8192 : 4096,
            ...(isGemini ? { reasoning_effort: "low" } : {}),
            ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
            messages: [
              { role: "system", content: input.system },
              { role: "user", content: input.user },
            ],
          }),
          signal: AbortSignal.timeout(30_000),
        });
      let response = await send(true);
      if (response.status === 400 || response.status === 422) response = await send(false);
      if (!response.ok) {
        const snippet = (await response.text().catch(() => "")).slice(0, 300);
        throw new Error(`LLM HTTP ${response.status}: ${snippet}`);
      }
      const body = (await response.json()) as {
        choices?: { message?: { content?: string }; finish_reason?: string }[];
      };
      const choice = body.choices?.[0];
      const content = choice?.message?.content;
      if (!content || choice?.finish_reason === "length") {
        throw new Error(
          `Respons LLM terpotong atau kosong (finish_reason: ${choice?.finish_reason ?? "tidak ada"}).`,
        );
      }
      return content.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    },
  };
}
