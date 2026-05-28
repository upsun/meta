import { promises as fs } from 'fs';
import path from 'path';
import { CloudExtensionsSchema } from '../schemas/extension.schema.js';

function getInputPath(): string {
  const inputPath = process.argv[2];

  if (!inputPath) {
    console.error('Usage: node dist/scripts/validate-cloud-extensions.js <path-to-extensions-json>');
    process.exit(1);
  }

  return path.resolve(inputPath);
}

async function main() {
  const extensionsPath = getInputPath();
  const fileName = path.basename(extensionsPath);

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
    console.error(`${fileName} is not valid JSON`);
    console.error(error);
    process.exit(1);
  }

  const cloudData = (data as { cloud?: unknown })?.cloud;

  if (!cloudData) {
    console.error(`${fileName} must contain a top-level "cloud" object`);
    process.exit(1);
  }

  const result = CloudExtensionsSchema.safeParse(cloudData);

  if (!result.success) {
    console.error(`${fileName} cloud section does not match the expected schema`);
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }

  console.log(`${fileName} is valid.`);
}

main().catch((error) => {
  console.error('Unexpected error during cloud extensions validation');
  console.error(error);
  process.exit(1);
});
