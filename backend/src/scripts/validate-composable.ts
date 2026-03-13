import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ComposableImageSchemaModel } from '../schemas/composable.schema.js';
import { z } from 'zod';

// Schema for composable.json which is a record of composable images
const ComposableListSchema = z.record(
  z.string(),
  ComposableImageSchemaModel
);

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const defaultComposablePath = path.resolve(scriptDir, '../../../resources/image/composable.json');
  const composablePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultComposablePath;

  let raw: string;
  try {
    raw = await fs.readFile(composablePath, 'utf8');
  } catch (error) {
    console.error(`Failed to read composable file at ${composablePath}`);
    console.error(error);
    process.exit(1);
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    console.error('composable.json is not valid JSON');
    console.error(error);
    process.exit(1);
  }

  const result = ComposableListSchema.safeParse(data);

  if (!result.success) {
    console.error('composable.json does not match the expected schema');
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }

  console.log('composable.json is valid.');
}

main().catch((error) => {
  console.error('Unexpected error during composable validation');
  console.error(error);
  process.exit(1);
});
