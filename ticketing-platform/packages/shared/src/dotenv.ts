import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

let loaded = false;

function parseEnvLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const separatorIndex = trimmed.indexOf('=');
  if (separatorIndex === -1) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

function findEnvFile(startDir: string) {
  let currentDir = path.resolve(startDir);

  while (true) {
    const candidate = path.join(currentDir, '.env');
    if (existsSync(candidate)) {
      return candidate;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }

    currentDir = parentDir;
  }
}

export function loadEnvFile(startDir = process.cwd()) {
  if (loaded) {
    return;
  }

  const envFile = findEnvFile(startDir);
  if (!envFile) {
    loaded = true;
    return;
  }

  const contents = readFileSync(envFile, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      continue;
    }

    if (process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  }

  loaded = true;
}
