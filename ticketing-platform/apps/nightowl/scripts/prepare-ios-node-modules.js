const fs = require('node:fs');
const path = require('node:path');

const workspaceRoot = path.resolve(__dirname, '..');
const expoPackageDir = path.dirname(require.resolve('expo/package.json', { paths: [workspaceRoot] }));
const expoNodeModulesDir = path.join(expoPackageDir, 'node_modules');

const expoNativePackages = ['expo-constants', 'expo-file-system'];

function ensureSymlink(packageName) {
  const sourceDir = path.dirname(require.resolve(`${packageName}/package.json`, { paths: [workspaceRoot] }));
  const targetDir = path.join(expoNodeModulesDir, packageName);

  fs.mkdirSync(expoNodeModulesDir, { recursive: true });

  try {
    const currentStats = fs.lstatSync(targetDir);
    if (currentStats.isSymbolicLink()) {
      const currentRealPath = fs.realpathSync(targetDir);
      const expectedRealPath = fs.realpathSync(sourceDir);

      if (currentRealPath === expectedRealPath) {
        return;
      }
    }

    fs.rmSync(targetDir, { recursive: true, force: true });
  } catch {
    // Nothing to clean up when the link is missing.
  }

  fs.symlinkSync(sourceDir, targetDir, 'dir');
}

for (const packageName of expoNativePackages) {
  ensureSymlink(packageName);
}

console.log(`Prepared Expo native package links for: ${expoNativePackages.join(', ')}`);
