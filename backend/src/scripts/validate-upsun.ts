import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { UpsunJsonSchemaSchema } from '../schemas/validation.schema.js';

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const defaultUpsunPath = path.resolve(scriptDir, '../../../resources/validation/upsun.json');
  const upsunPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultUpsunPath;

  let raw: string;
  try {
    raw = await fs.readFile(upsunPath, 'utf8');
  } catch (error) {
    console.error(`Failed to read upsun validation file at ${upsunPath}`);
    console.error(error);
    process.exit(1);
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    console.error('upsun.json is not valid JSON');
    console.error(error);
    process.exit(1);
  }

  const result = UpsunJsonSchemaSchema.safeParse(data);

  if (!result.success) {
    console.error('upsun.json does not match the expected JSON Schema structure');
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }

  console.log('upsun.json is valid.');
}

main().catch((error) => {
  console.error('Unexpected error during upsun validation');
  console.error(error);
  process.exit(1);
});
