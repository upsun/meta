import { config } from '../config/env.config.js';
import { Request, Response } from 'express';
import { z } from 'zod';
import { ApiRouter } from '../utils/api.router.js';
import { ResourceManager, logger, extractConditionalHeaders, setCacheHeaders, sendNotModified } from '../utils/index.js';
import { sendErrorFormatted, sendFormatted } from '../utils/response.format.js';
import {
  ComposableImageDto,
  ComposableImageSchemaDtoInternal,
  ComposableImageSchemaDtoPublic,
  NixRuntimesResponseDto,
  NixRuntimesResponseSchemaDto
} from '../schemas/composable.schema.js';
import { HeaderAcceptSchema, ErrorDetailsSchema } from '../schemas/api.schema.js';
import { compareSemverLike, getHighestVersion } from '../utils/version.utils.js';

const TAG = 'Composable Image';
const PATH = '/composable';

// Create dedicated API logger
const apiLogger = logger.child({ component: 'API' });

// Initialize Resource Manager
const resourceManager = new ResourceManager();

// ========================================
// COMPOSABLE ROUTES
// ========================================
export const composableRouter = new ApiRouter();

// ========================================
// GET /composable - Get composable image
// ========================================
composableRouter.route({
  method: 'get',
  path: `${PATH}`,
  summary: 'Get Composable Image channels',
  description: `Returns the Composable Image configuration with all its information (name, Nix channels aka versions, etc.).`,
  tags: [TAG],
  headers: HeaderAcceptSchema,
  responses: {
    200: {
      description: 'Composable Image configuration',
      schema: ComposableImageSchemaDtoPublic,
      contentTypes: ['application/json', 'application/x-yaml'],
    },
    500: {
      description: 'Internal server error',
      schema: ErrorDetailsSchema,
      contentTypes: ['application/json', 'application/x-yaml']
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      // Load composable resource with metadata, supporting conditional requests
      const conditionalHeaders = extractConditionalHeaders(req);
      const { data: composableData, metadata, notModified } = await resourceManager.getResourceWithMetadata('image/composable.json', conditionalHeaders);

      // If upstream returned 304, respond with 304 (avoids unnecessary parsing)
      if (notModified) {
        return sendNotModified(res, metadata, config.cache.TTL);
      }

      // Extract the "composable" object from the file
      const composableRaw = composableData.composable;

      if (!composableRaw) {
        apiLogger.error('Composable Image object not found in composable.json');
        
        return sendErrorFormatted(res, {
          title: 'Composable Image not found',
          detail: 'The "composable" object was not found in the configuration file.',
          status: 500
        });
      }

      // Validate and parse composable (depending public or internal)
      const composableParsed = req.headers.internal === 'true'
        ? ComposableImageSchemaDtoInternal.parse(composableRaw)
        : ComposableImageSchemaDtoPublic.parse(composableRaw);

      // Set cache headers
      setCacheHeaders(res, metadata, config.cache.TTL);

      // Send formatted response
      sendFormatted<ComposableImageDto>(res, composableParsed);

    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read composable configuration');

      sendErrorFormatted(res, {
        title: 'Unable to read composable configuration',
        detail: error.message || 'An unexpected error occurred while reading composable configuration',
        status: 500
      });
    }
  }
});

// ========================================
// GET /composable - Get Nix Runtimes
// ========================================
composableRouter.route({
  method: 'get',
  path: `${PATH}/nix-runtimes`,
  summary: 'Get Nix Runtimes',
  description: `Returns the list of Nix runtimes available in packages_versions for a Nix channel. Defaults to the highest Nix channel version when no query param is provided.`,
  tags: [TAG],
  query: z.object({
    channel: z.string().optional().describe('Optional Nix channel (e.g., 25.11). Default to the latest Nix channel available in the composable configuration if not provided. If the specified channel does not exist, a 404 error is returned.')
  }),
  headers: HeaderAcceptSchema,
  responses: {
    200: {
      description: 'List of Nix Runtimes',
      schema: NixRuntimesResponseSchemaDto,
      contentTypes: ['application/json', 'application/x-yaml'],
    },
    404: {
      description: 'Nix channel or packages_versions not found',
      schema: ErrorDetailsSchema,
      contentTypes: ['application/json', 'application/x-yaml'],
    },
    500: {
      description: 'Internal server error',
      schema: ErrorDetailsSchema,
      contentTypes: ['application/json', 'application/x-yaml']
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const requestedChannel = typeof req.query.channel === 'string' ? req.query.channel : undefined;
      const queryParams = requestedChannel ? { channel: requestedChannel } : undefined;

      // Load composable resource with metadata, supporting conditional requests
      const conditionalHeaders = extractConditionalHeaders(req);
      const { data: composableData, metadata, notModified } = await resourceManager.getResourceWithMetadata('image/composable.json', conditionalHeaders);

      // If upstream returned 304, respond with 304 (avoids unnecessary parsing)
      if (notModified) {
        return sendNotModified(res, metadata, config.cache.TTL, queryParams);
      }

      // Extract the "composable" object from the file
      const composableRaw = composableData.composable;

      if (!composableRaw) {
        apiLogger.error('Composable Image object not found in composable.json');
        
        return sendErrorFormatted(res, {
          title: 'Composable Image not found',
          detail: 'The "composable" object was not found in the configuration file.',
          status: 500
        });
      }

      const composableParsed = ComposableImageSchemaDtoInternal.parse(composableRaw);

      const selectedChannel = requestedChannel || getHighestVersion(composableParsed.versions);
      if (!selectedChannel) {
        return sendErrorFormatted(res, {
          title: 'Nix channel not found',
          detail: 'No Nix channel entries were found in composable configuration.',
          status: 404
        });
      }

      const channelData = composableParsed.versions[selectedChannel];
      if (!channelData) {
        return sendErrorFormatted(res, {
          title: 'Nix channel not found',
          detail: `Nix channel '${selectedChannel}' does not exist in Composable Image configuration.`,
          status: 404,
          extra: {
            availableChannels: Object.keys(composableParsed.versions)
          }
        });
      }

      if (!channelData.packages_versions) {
        const availableChannelsWithPackages = Object.entries(composableParsed.versions)
          .filter(([, data]) => Boolean(data.packages_versions))
          .map(([version]) => version)
          .sort(compareSemverLike);

        return sendErrorFormatted(res, {
          title: 'packages_versions not available',
          detail: `No packages_versions were found for Nix channel '${selectedChannel}'.`,
          status: 404,
          extra: {
            availableChannelsWithPackages
          }
        });
      }

      const responsePayload: NixRuntimesResponseDto = {
        version: selectedChannel,
        packages_versions: channelData.packages_versions
      };

      const validatedPayload = NixRuntimesResponseSchemaDto.parse(responsePayload);

      // Set cache headers
      setCacheHeaders(res, metadata, config.cache.TTL, queryParams);

      // Send formatted response
      sendFormatted<NixRuntimesResponseDto>(res, validatedPayload);

    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read composable configuration');

      sendErrorFormatted(res, {
        title: 'Unable to read composable configuration',
        detail: error.message || 'An unexpected error occurred while reading composable configuration',
        status: 500
      });
    }
  }
});
