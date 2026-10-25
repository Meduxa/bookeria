import { describe, expect, it } from "vitest";
import { safeNext, signUpSchema } from "./schema";

describe("safeNext", () => {
  it("allows same-site paths", () => {
    expect(safeNext("/ka/dashboard", "/ka")).toBe("/ka/dashboard");
    expect(safeNext("/en/invite/abc123", "/en")).toBe("/en/invite/abc123");
  });

  it.each(["//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)", undefined, 42])(
    "rejects %j",
    (value) => {
      expect(safeNext(value, "/ka")).toBe("/ka");
    },
  );
});

describe("signUpSchema", () => {
  it("normalises email and enforces password length", () => {
    const parsed = signUpSchema.safeParse({
      fullName: "ნინო",
      email: " Nino@Example.COM ",
      password: "12345678",
    });
    expect(parsed.success && parsed.data.email).toBe("nino@example.com");
    expect(signUpSchema.safeParse({ fullName: "ნინო", email: "n@e.ge", password: "short" }).success).toBe(
      false,
    );
  });
});
