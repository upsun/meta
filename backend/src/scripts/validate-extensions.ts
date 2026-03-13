import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RuntimeExtensionListSchema } from '../schemas/extension.schema.js';
import { z } from 'zod';

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const defaultExtensionsPath = path.resolve(scriptDir, '../../../resources/extension/php_extensions.json');
  const extensionsPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultExtensionsPath;

  let raw: string;
  try {
    raw = await fs.readFile(extensionsPath, 'utf8');
  } catch (error) {
    console.error(`Failed to read extensions file at ${extensionsPath}`);
    console.error(error);
    process.exit(1);
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    console.error('php_extensions.json is not valid JSON');
    console.error(error);
    process.exit(1);
  }

  const result = RuntimeExtensionListSchema.safeParse(data);

  if (!result.success) {
    console.error('php_extensions.json does not match the expected schema');
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }

  console.log('php_extensions.json is valid.');
}

main().catch((error) => {
  console.error('Unexpected error during extensions validation');
  console.error(error);
  process.exit(1);
});
