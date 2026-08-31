import { describe, expect, it } from "vitest";
import { hashPassword, passwordSchema, verifyPassword } from "@/server/auth/password";

describe("password security", () => {
  it("hashes and verifies a valid password without storing plaintext", async () => {
    const password = "uma-senha-longa-e-segura";
    const passwordHash = await hashPassword(password);
    expect(passwordHash).not.toContain(password);
    await expect(verifyPassword(password, passwordHash)).resolves.toBe(true);
    await expect(verifyPassword("senha-incorreta", passwordHash)).resolves.toBe(false);
  });

  it("accepts long passphrases and rejects short passwords", () => {
    expect(passwordSchema.safeParse("frase secreta longa para gestor").success).toBe(true);
    expect(passwordSchema.safeParse("curta").success).toBe(false);
  });
});
