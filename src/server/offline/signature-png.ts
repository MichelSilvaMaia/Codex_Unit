import { inflateSync } from "node:zlib";
import { AppError } from "@/server/errors/app-error";

const invalid = () => new AppError("VALIDATION_ERROR", "Assinatura PNG vazia ou inválida.");

/** Decodes the RGBA canvas PNG and requires at least one non-transparent pixel. */
export function validateDrawnPng(content: Uint8Array, width: number, height: number) {
  const bytes = Buffer.from(content);
  if (bytes.length < 70 || bytes.length > 2_000_000 || ![0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) throw invalid();
  if (width < 100 || width > 4096 || height < 50 || height > 4096 || bytes.readUInt32BE(8) !== 13 || bytes.toString("ascii", 12, 16) !== "IHDR" || bytes.readUInt32BE(16) !== width || bytes.readUInt32BE(20) !== height || bytes[24] !== 8 || bytes[25] !== 6 || bytes[28] !== 0) throw invalid();
  const chunks: Buffer[] = [];
  let offset = 8, ended = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset), name = bytes.toString("ascii", offset + 4, offset + 8);
    if (length > bytes.length - offset - 12) throw invalid();
    if (name === "IDAT") chunks.push(bytes.subarray(offset + 8, offset + 8 + length));
    if (name === "IEND") { ended = true; break; }
    offset += length + 12;
  }
  if (!ended || !chunks.length) throw invalid();
  const stride = width * 4, expected = (stride + 1) * height;
  let raw: Buffer;
  try { raw = inflateSync(Buffer.concat(chunks), { maxOutputLength: expected }); } catch { throw invalid(); }
  if (raw.length !== expected) throw invalid();
  let previous = Buffer.alloc(stride), ink = false;
  for (let row = 0; row < height; row++) {
    const filter = raw[row * (stride + 1)], current = Buffer.alloc(stride);
    if (filter > 4) throw invalid();
    for (let i = 0; i < stride; i++) {
      const value = raw[row * (stride + 1) + i + 1], left = i >= 4 ? current[i - 4] : 0, up = previous[i], upperLeft = i >= 4 ? previous[i - 4] : 0;
      const predictor = left + up - upperLeft;
      const paeth = Math.abs(predictor - left) <= Math.abs(predictor - up) && Math.abs(predictor - left) <= Math.abs(predictor - upperLeft) ? left : Math.abs(predictor - up) <= Math.abs(predictor - upperLeft) ? up : upperLeft;
      current[i] = (value + (filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2) : filter === 4 ? paeth : 0)) & 255;
    }
    for (let i = 3; i < stride; i += 4) if (current[i] > 16 && current[i - 3] + current[i - 2] + current[i - 1] < 700) ink = true;
    previous = current;
  }
  if (!ink) throw invalid();
}
