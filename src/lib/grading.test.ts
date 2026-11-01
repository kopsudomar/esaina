import { describe, expect, it } from "vitest";
import { sumScores, withProvenance } from "./grading";

function validScores(items: { score: number | null; min: number; max: number }[]) {
  return items.every((x) => x.score === null || (x.score >= x.min && x.score <= x.max));
}

describe("manual grading invariants", () => {
  it("menolak skor di luar rentang rubrik", () => {
    expect(validScores([{ score: 3, min: 0, max: 2 }])).toBe(false);
  });
  it("mempertahankan nilai kosong sebagai null", () => {
    expect(validScores([{ score: null, min: 0, max: 2 }])).toBe(true);
  });
  it("total hanya menjumlah skor terisi", () => {
    expect(sumScores([{ score: 2 }, { score: null }, { score: 1 }])).toBe(3);
  });
});

describe("withProvenance", () => {
  const aiItem = { questionId: "q1", criterionId: "c1", score: 2, feedback: "ok", source: "AI" as const, aiResultId: "ai1" };

  it("mempertahankan provenance AI bila skor dan feedback tidak berubah", () => {
    const [item] = withProvenance([aiItem], [{ questionId: "q1", criterionId: "c1", score: 2, feedback: "ok" }]);
    expect(item).toEqual(aiItem);
  });

  it("menurunkan provenance ke MANUAL bila skor berubah", () => {
    const [item] = withProvenance([aiItem], [{ questionId: "q1", criterionId: "c1", score: 3, feedback: "ok" }]);
    expect(item.source).toBe("MANUAL");
    expect(item.aiResultId).toBeNull();
  });

  it("menurunkan provenance ke MANUAL bila feedback berubah", () => {
    const [item] = withProvenance([aiItem], [{ questionId: "q1", criterionId: "c1", score: 2, feedback: "lain" }]);
    expect(item.source).toBe("MANUAL");
    expect(item.aiResultId).toBeNull();
  });

  it("item baru selalu MANUAL", () => {
    const [item] = withProvenance([aiItem], [{ questionId: "q2", criterionId: "c1", score: 1, feedback: "" }]);
    expect(item.source).toBe("MANUAL");
    expect(item.aiResultId).toBeNull();
  });
});
