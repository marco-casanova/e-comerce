type ParseOptions<T> = {
  defaultValue?: T;
  parse: (raw: string) => T | null;
};

function readRawPublicEnv(name: string) {
  const rawValue = process.env[name];
  if (!rawValue) {
    return undefined;
  }

  const value = rawValue.trim();
  return value.length ? value : undefined;
}

export function readPublicEnv(name: string) {
  return readRawPublicEnv(name);
}

export function readParsedPublicEnv<T>(name: string, options: ParseOptions<T>) {
  const rawValue = readRawPublicEnv(name);

  if (!rawValue) {
    return options.defaultValue;
  }

  const parsed = options.parse(rawValue);
  if (parsed === null) {
    return options.defaultValue;
  }

  return parsed;
}

export function parsePositiveInteger(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function parseBoolean(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  return null;
}
