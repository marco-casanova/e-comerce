import { IS_E2E_MODE } from './appConfig';

let runtimeE2EMode = false;

export function enableRuntimeE2EMode() {
  runtimeE2EMode = true;
}

export function getIsE2EModeEnabled() {
  return IS_E2E_MODE || runtimeE2EMode;
}

export function syncRuntimeModeFromUrl(url: string | null | undefined) {
  if (!url) {
    return false;
  }

  const normalized = url.toLowerCase();
  if (!normalized.startsWith('nightowl://e2e')) {
    return false;
  }

  enableRuntimeE2EMode();
  return true;
}
