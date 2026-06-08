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