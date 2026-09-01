import { AppError } from "@/server/errors/app-error";

function partsInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}:${value.second}`;
}

export function formatForDateTimeLocal(date: Date, timeZone: string) {
  return partsInZone(date, timeZone).slice(0, 16);
}

export function isValidTimeZone(timeZone: string) {
  try { new Intl.DateTimeFormat("pt-BR", { timeZone }).format(); return true; } catch { return false; }
}

export function zonedDateTimeToUtc(localDateTime: string, timeZone: string) {
  if (!isValidTimeZone(timeZone) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(localDateTime)) throw new AppError("VALIDATION_ERROR", "Data, hora ou timezone inválido.");
  const normalized = localDateTime.length === 16 ? `${localDateTime}:00` : localDateTime;
  const desired = Date.parse(`${normalized}Z`);
  let candidate = new Date(desired);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const represented = Date.parse(`${partsInZone(candidate, timeZone)}Z`);
    candidate = new Date(candidate.valueOf() + desired - represented);
  }
  if (partsInZone(candidate, timeZone) !== normalized) throw new AppError("VALIDATION_ERROR", "Horário local inexistente ou ambíguo no timezone da empresa.");
  return candidate;
}

export function formatInTimeZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone, dateStyle: "short", timeStyle: "short" }).format(date);
}
