// Bundles a service into a single CJS file for its Docker image.
//   node tools/build-service.mjs <serviceName>
//
// Workspace libs (@smartwash/*) are aliased to their source and inlined into
// the bundle; all npm packages stay external (installed in the image's
// node_modules). Type-checking is done separately by `tsc --noEmit`.
import { build } from 'esbuild';
import { resolve } from 'node:path';

const service = process.argv[2];
if (!service) {
  console.error('usage: node tools/build-service.mjs <serviceName>');
  process.exit(1);
}

const root = process.cwd();

await build({
  entryPoints: [resolve(root, `services/${service}/src/main.ts`)],
  outfile: resolve(root, `dist/services/${service}/main.cjs`),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: true,
  // All bare imports (npm) stay external; the aliases below resolve to files
  // and therefore get bundled.
  packages: 'external',
  alias: {
    '@smartwash/common': resolve(root, 'libs/common/src/index.ts'),
    '@smartwash/nestkit': resolve(root, 'libs/nestkit/src/index.ts'),
  },
  logLevel: 'info',
});

console.log(`[build] bundled services/${service} -> dist/services/${service}/main.cjs`);
