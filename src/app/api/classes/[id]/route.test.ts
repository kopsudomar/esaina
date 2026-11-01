import { describe, expect, it, vi, beforeEach } from "vitest";

const requireTeacher = vi.fn();
const requireClassOwner = vi.fn();
vi.mock("@/lib/auth/guard", async () => {
  const { errorResponse } = await vi.importActual<typeof import("@/lib/auth/guard")>("@/lib/auth/guard");
  return {
    requireTeacher: (...a: unknown[]) => requireTeacher(...a),
    requireClassOwner: (...a: unknown[]) => requireClassOwner(...a),
    route:
      (handler: (req: Request, ...args: unknown[]) => Promise<Response>) =>
      async (req: Request, ...args: unknown[]) => {
        try {
          return await handler(req, ...args);
        } catch (error) {
          return errorResponse(error);
        }
      },
  };
});

const classFindUnique = vi.fn();
const classUpdate = vi.fn();
const deleteMany = vi.fn();
const classDelete = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    class: {
      findUnique: (...a: unknown[]) => classFindUnique(...a),
      update: (...a: unknown[]) => classUpdate(...a),
      delete: (...a: unknown[]) => classDelete(...a),
    },
    classMembership: { deleteMany: (...a: unknown[]) => deleteMany(...a) },
    $transaction: (ops: unknown[]) => Promise.all(ops),
  },
}));

const { DELETE, PATCH } = await import("./route");

const TEACHER = { id: "u1", name: "Guru", email: "t@x.id", role: "TEACHER" as const };
const ctx = { params: Promise.resolve({ id: "c1" }) };

const req = (body: unknown) =>
  new Request("http://localhost/api/classes/c1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  requireTeacher.mockReset().mockResolvedValue(TEACHER);
  requireClassOwner.mockReset().mockResolvedValue({ id: "c1" });
  classFindUnique.mockReset();
  classUpdate.mockReset();
  deleteMany.mockReset();
  classDelete.mockReset();
});

describe("DELETE /api/classes/[id]", () => {
  it("menolak 409 bila kelas masih punya asesmen", async () => {
    classFindUnique.mockResolvedValue({ _count: { assessments: 2 } });
    const res = await DELETE(new Request("http://localhost/api/classes/c1", { method: "DELETE" }), ctx);
    expect(res.status).toBe(409);
    expect(classDelete).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/classes/[id]", () => {
  it("menolak body kosong dengan 422", async () => {
    const res = await PATCH(req({}), ctx);
    expect(res.status).toBe(422);
    expect(classUpdate).not.toHaveBeenCalled();
  });
});
