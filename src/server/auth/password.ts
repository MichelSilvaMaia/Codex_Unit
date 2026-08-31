import { compare, hash } from "bcryptjs";
import { z } from "zod";

const PASSWORD_COST = 12;

export const passwordSchema = z
  .string()
  .min(12, "A senha deve ter pelo menos 12 caracteres.")
  .max(128, "A senha deve ter no máximo 128 caracteres.");

export async function hashPassword(password: string) {
  const validated = passwordSchema.parse(password);
  return hash(validated, PASSWORD_COST);
}

export async function verifyPassword(password: string, passwordHash: string) {
  if (password.length > 128) return false;
  return compare(password, passwordHash);
}
