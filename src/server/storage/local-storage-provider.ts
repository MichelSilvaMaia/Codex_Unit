import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageProvider } from "./storage-provider";
const root = path.resolve(process.cwd(), ".data", "private-evidence");
function resolveKey(key: string) { const target = path.resolve(root, key); if (!target.startsWith(root + path.sep)) throw new Error("Invalid storage key"); return target; }
export const localStorageProvider: StorageProvider = {
  async put(key, content, contentType) { const target = resolveKey(key); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, content); return { key, contentType, size: content.byteLength }; },
  async get(key) { return readFile(resolveKey(key)); },
  async getSignedReadUrl(key) { return `/api/pickup-evidence/${encodeURIComponent(key)}`; },
  async delete(key) { await rm(resolveKey(key), { force: true }); },
};
