/**
 * Contract validation (CI gate: `nx run contracts:validate`).
 *
 *  1. Each OpenAPI 3.1 spec under contracts/openapi/*.yaml must parse,
 *     dereference, and validate against the OpenAPI schema.
 *  2. Each JSON-schema event/MQTT contract must itself be a valid 2020-12
 *     schema that Ajv can compile.
 *
 * Exits non-zero on the first failure so a broken contract fails the build.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import SwaggerParser from '@apidevtools/swagger-parser';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

const CONTRACTS_DIR =
  process.env.CONTRACTS_DIR ?? resolve(__dirname, '../../../contracts');

async function validateOpenApi(dir: string): Promise<number> {
  const files = readdirSync(dir).filter(
    (f) => f.endsWith('.yaml') || f.endsWith('.yml'),
  );
  for (const file of files) {
    const path = join(dir, file);
    // validate() parses + dereferences + checks against the OpenAPI schema.
    await SwaggerParser.validate(path);
    console.log(`[contracts] OK  openapi  ${file}`);
  }
  return files.length;
}

function validateJsonSchemas(...paths: string[]): number {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  let count = 0;
  for (const path of paths) {
    const schema = JSON.parse(readFileSync(path, 'utf8'));
    // compile() throws if the schema is structurally invalid.
    ajv.compile(schema);
    console.log(`[contracts] OK  jsonschema  ${basename(path)}`);
    count += 1;
  }
  return count;
}

async function main(): Promise<void> {
  const openApiCount = await validateOpenApi(join(CONTRACTS_DIR, 'openapi'));
  const schemaCount = validateJsonSchemas(
    join(CONTRACTS_DIR, 'events', 'events.schema.json'),
    join(CONTRACTS_DIR, 'mqtt', 'mqtt.schema.json'),
  );
  console.log(
    `[contracts] all valid — ${openApiCount} OpenAPI, ${schemaCount} JSON-schema`,
  );
}

main().catch((err) => {
  console.error('[contracts] validation failed:');
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
