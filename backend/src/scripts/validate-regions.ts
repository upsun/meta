import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HostRegionsListSchema } from '../schemas/region.schema.js';
import { z } from 'zod';

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const defaultRegionsPath = path.resolve(scriptDir, '../../../resources/host/regions.json');
  const regionsPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultRegionsPath;

  let raw: string;
  try {
    raw = await fs.readFile(regionsPath, 'utf8');
  } catch (error) {
    console.error(`Failed to read regions file at ${regionsPath}`);
    console.error(error);
    process.exit(1);
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    console.error('regions.json is not valid JSON');
    console.error(error);
    process.exit(1);
  }

  const result = HostRegionsListSchema.safeParse(data);

  if (!result.success) {
    console.error('regions.json does not match the expected schema');
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }

  console.log('regions.json is valid.');
}

main().catch((error) => {
  console.error('Unexpected error during regions validation');
  console.error(error);
  process.exit(1);
});
