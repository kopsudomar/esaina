import { describe, expect, it } from "vitest";
import { mergeAiItems } from "./route";

const manual = { questionId: "q1", criterionId: "c1", score: 5, source: "MANUAL" as const };
const aiOld = { questionId: "q2", criterionId: "c1", score: 2, source: "AI" as const };

describe("mergeAiItems", () => {
  it("item manual menang atas item AI dengan kunci sama", () => {
    const r = mergeAiItems([manual], [
      { questionId: "q1", criterionId: "c1", score: 0, feedback: "ai" },
      { questionId: "q2", criterionId: "c1", score: 3, feedback: "ai" },
    ]);
    expect(r.items.map((i) => i.questionId)).toEqual(["q2"]);
  });

  it("total = manual + AI hasil akhir, bukan payload mentah", () => {
    const r = mergeAiItems([manual, aiOld], [
      { questionId: "q1", criterionId: "c1", score: 0, feedback: "ai" },
      { questionId: "q2", criterionId: "c1", score: 3, feedback: "ai" },
    ]);
    expect(r.totalScore).toBe(8);
  });

  it("nilai manual kosong tidak dihitung sebagai nol", () => {
    const r = mergeAiItems([{ ...manual, score: null }], [{ questionId: "q2", criterionId: "c1", score: 4, feedback: "ai" }]);
    expect(r.totalScore).toBe(4);
    expect(r.manual).toHaveLength(1);
  });
});
