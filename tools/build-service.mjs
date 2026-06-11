// Bundles a service into a single CJS file for its Docker image.
//   node tools/build-service.mjs <serviceName>
//
// Two steps — both matter:
//   1) tsc emits real JS into build-out/ (tsconfig.docker.json). esbuild cannot
//      emit TypeScript's design:paramtypes decorator metadata, which NestJS
//      constructor injection needs at runtime; transpiling straight from TS
//      produced images whose DI silently resolved to undefined (caught in the
//      first Docker E2E).
//   2) esbuild bundles the EMITTED JS. Workspace libs (@smartwash/*) are
//      aliased to their emitted entrypoints and inlined; npm packages stay
//      external (installed in the image's node_modules).
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { build } from 'esbuild';
import { resolve } from 'node:path';

const service = process.argv[2];
if (!service) {
  console.error('usage: node tools/build-service.mjs <serviceName>');
  process.exit(1);
}

const root = process.cwd();

// 1) Emit JS with decorator metadata (incremental — cheap when unchanged).
execSync('npx tsc -p tsconfig.docker.json', { stdio: 'inherit', cwd: root });

const entry = resolve(root, `build-out/services/${service}/src/main.js`);
if (!existsSync(entry)) {
  console.error(`[build] emitted entry not found: ${entry}`);
  process.exit(1);
}

// 2) Bundle the emitted JS.
await build({
  entryPoints: [entry],
  outfile: resolve(root, `dist/services/${service}/main.cjs`),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: true,
  packages: 'external',
  alias: {
    '@smartwash/common': resolve(root, 'build-out/libs/common/src/index.js'),
    '@smartwash/nestkit': resolve(root, 'build-out/libs/nestkit/src/index.js'),
  },
  logLevel: 'info',
});

console.log(`[build] bundled services/${service} -> dist/services/${service}/main.cjs`);
