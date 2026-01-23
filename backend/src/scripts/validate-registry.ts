import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ImageListSchema } from '../schemas/image.schema.js';
import { z } from 'zod';

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const defaultRegistryPath = path.resolve(scriptDir, '../../../resources/image/registry.json');
  const registryPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultRegistryPath;

  let raw: string;
  try {
    raw = await fs.readFile(registryPath, 'utf8');
  } catch (error) {
    console.error(`Failed to read registry file at ${registryPath}`);
    console.error(error);
    process.exit(1);
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    console.error('registry.json is not valid JSON');
    console.error(error);
    process.exit(1);
  }

  const result = ImageListSchema.safeParse(data);

  if (!result.success) {
    console.error('registry.json does not match the expected schema');
    console.error(JSON.stringify(result.error.format(), null, 2));
  const testEnum = z.enum(["HIGH_CPU","BALANCED","HIGH_MEMORY","HIGHER_MEMORY"]);
   console.log(testEnum.safeParse("HIGH_CPU")); // devrait afficher { success: true, ... }

    process.exit(1);
  }

  console.log('registry.json is valid.');

}

main().catch((error) => {
  console.error('Unexpected error during registry validation');
  console.error(error);
  process.exit(1);
});
