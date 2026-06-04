import { promises as fs } from 'fs';
import path from 'path';
import {
  CloudExtensionsSchema,
  PostgresqlCloudExtensionsSchema,
  RuntimeExtensionListSchema,
  SolrCloudExtensionsSchema
} from '../schemas/extension.schema.js';

type ValidatorKind = 'php' | 'postgresql' | 'solr';

function getValidatorKind(fileName: string): ValidatorKind {
  if (fileName.includes('postgresql')) {
    return 'postgresql';
  }

  if (fileName.includes('solr')) {
    return 'solr';
  }

  return 'php';
}

function getSchema(kind: ValidatorKind) {
  switch (kind) {
    case 'postgresql':
      return PostgresqlCloudExtensionsSchema;
    case 'solr':
      return SolrCloudExtensionsSchema;
    default:
      return CloudExtensionsSchema;
  }
}

function getDescriptionMessage(kind: ValidatorKind, extensionName: string): string {
  if (kind === 'postgresql') {
    return `Please update description of the postgresql extension \`${extensionName}\` in Meta Version Updater tool and update the PR`;
  }

  if (kind === 'solr') {
    return `Please update description for solr extension \`${extensionName}\` in Meta Version Updater tool and update the PR`;
  }

  return `Please update description of the php extension \`${extensionName}\` in Meta Version Updater tool and update the PR`;
}

function ensureDescriptionsPresent(kind: ValidatorKind, cloudData: unknown, fileName: string): void {
  if (!cloudData || typeof cloudData !== 'object') {
    return;
  }

  for (const [extensionName, extensionEntry] of Object.entries(cloudData as Record<string, unknown>)) {
    if (extensionName === '_links') {
      continue;
    }

    if (!extensionEntry || typeof extensionEntry !== 'object') {
      continue;
    }

    const description = (extensionEntry as { description?: unknown }).description;
    if (typeof description !== 'string' || description.trim().length === 0) {
      console.error(getDescriptionMessage(kind, extensionName));
      process.exit(1);
    }
  }
}

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
  const validatorKind = getValidatorKind(fileName);
  const schema = getSchema(validatorKind);

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

  ensureDescriptionsPresent(validatorKind, cloudData, fileName);

  if (validatorKind === 'php') {
    const dedicatedData = (data as { dedicated?: unknown })?.dedicated;
    if (dedicatedData) {
      ensureDescriptionsPresent(validatorKind, dedicatedData, fileName);
    }

    const result = RuntimeExtensionListSchema.safeParse(data);
    if (!result.success) {
      console.error(`${fileName} does not match the expected schema`);
      console.error(JSON.stringify(result.error.format(), null, 2));
      process.exit(1);
    }
  } else {
    const result = schema.safeParse(cloudData);
    if (!result.success) {
      console.error(`${fileName} cloud section does not match the expected schema`);
      console.error(JSON.stringify(result.error.format(), null, 2));
      process.exit(1);
    }
  }

  console.log(`${fileName} is valid.`);
}

main().catch((error) => {
  console.error('Unexpected error during cloud extensions validation');
  console.error(error);
  process.exit(1);
});
