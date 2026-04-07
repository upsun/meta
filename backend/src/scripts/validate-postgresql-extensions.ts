import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CloudExtensionsSchema } from '../schemas/extension.schema.js';

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const defaultExtensionsPath = path.resolve(scriptDir, '../../../resources/extension/postgresql_extensions.json');
  const extensionsPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultExtensionsPath;

  let raw: string;
  try {
    raw = await fs.readFile(extensionsPath, 'utf8');
  } catch (error) {
    console.error(`Failed to read PostgreSQL extensions file at ${extensionsPath}`);
    console.error(error);
    process.exit(1);
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    console.error('postgresql_extensions.json is not valid JSON');
    console.error(error);
    process.exit(1);
  }

  const cloudData = (data as { cloud?: unknown })?.cloud;

  if (!cloudData) {
    console.error('postgresql_extensions.json must contain a top-level "cloud" object');
    process.exit(1);
  }

  const result = CloudExtensionsSchema.safeParse(cloudData);

  if (!result.success) {
    console.error('postgresql_extensions.json cloud section does not match the expected schema');
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }

  console.log('postgresql_extensions.json is valid.');
}

main().catch((error) => {
  console.error('Unexpected error during PostgreSQL extensions validation');
  console.error(error);
  process.exit(1);
});
