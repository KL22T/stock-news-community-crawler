import fs from 'node:fs';
import path from 'node:path';

export function resolveFromRoot(...paths: string[]): string {
  return path.resolve(process.cwd(), ...paths);
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function saveJson(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function getKstParts(date = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
} {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);

  return {
    year: kst.getUTCFullYear(),
    month: kst.getUTCMonth() + 1,
    day: kst.getUTCDate(),
    hour: kst.getUTCHours(),
    minute: kst.getUTCMinutes(),
    second: kst.getUTCSeconds(),
    millisecond: kst.getUTCMilliseconds(),
  };
}

export function formatKstDateTime(date = new Date()): string {
  const parts = getKstParts(date);

  return (
    `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}` +
    `T${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}+09:00`
  );
}

export function formatKstTimestampId(date = new Date()): string {
  const parts = getKstParts(date);

  return (
    `${parts.year}${pad2(parts.month)}${pad2(parts.day)}` +
    `${pad2(parts.hour)}${pad2(parts.minute)}${pad2(parts.second)}` +
    String(parts.millisecond).padStart(3, '0')
  );
}
