const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { spawn } = require('node:child_process');

function parseDotenvFile(filePath) {
  try {
    const contents = readFileSync(filePath, 'utf8');
    const env = {};

    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }

      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
      env[key] = value;
    }

    return env;
  } catch {
    return {};
  }
}

function main() {
  const configuration = process.argv[2] ?? 'Debug';
  const shouldForceBundling = process.argv.includes('--force-bundling');
  const appRoot = resolve(__dirname, '..');
  const envFile = resolve(appRoot, '.env');
  const fileEnv = parseDotenvFile(envFile);

  const env = {
    ...process.env,
    ...fileEnv,
    EXPO_NO_DOTENV: '1',
    EXPO_PUBLIC_APP_ENV: 'e2e',
    EXPO_PUBLIC_E2E_MODE: 'true',
    EXPO_PUBLIC_API_URL: 'http://127.0.0.1:9/v1',
    EXPO_PUBLIC_API_TIMEOUT_MS: '250',
    EXPO_PUBLIC_API_MAX_RETRIES: '1',
    RCT_NO_LAUNCH_PACKAGER: '1',
  };

  if (shouldForceBundling) {
    env.FORCE_BUNDLING = '1';
  }

  const child = spawn(
    'xcodebuild',
    [
      '-workspace',
      'ios/nightowl.xcworkspace',
      '-scheme',
      'nightowl',
      '-configuration',
      configuration,
      '-sdk',
      'iphonesimulator',
      '-derivedDataPath',
      'ios/build',
    ],
    {
      cwd: appRoot,
      env,
      stdio: 'inherit',
    },
  );

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });
}

main();
