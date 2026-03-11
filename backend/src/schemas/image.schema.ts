import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { LinkSchema } from './links.schema.js';

// Extend Zod with OpenAPI
extendZodWithOpenApi(z);

// ========================================
// Full models
// ========================================

/**
 * Schema for Images Registry
 */
export const DeployImageVersionStatusSchemaModel = z.enum([
    "supported",      // Officially supported and maintained version, receiving regular updates and security patches.
    "deprecated",     // No longer recommended for use, may still receive critical security updates but no new features or regular maintenance.
    "retired",        // Available but not maintained
    "decommissioned"  // Not available anymore
  ])
  .openapi({
    description: 'Status of the image version, following official lifecycle.', //TODO add description for each possible status
    example: 'supported'
  })
;

/**
 * Schema for Image Version
 */
export const DeployImageVersionSchemaModel = z.object({
  upsun: z.object({
    status: DeployImageVersionStatusSchemaModel,
    internal_support: z.boolean()
      .openapi({
        description: 'Indicates if the version has support from Upsun (Internal branch is protected)',
        example: true
      })
  }).openapi({
    description: 'Upsun specific version information',
    example: {
      status: 'supported',
      internal_support: true
    }
  }),
  upstream: z.object({
      status: DeployImageVersionStatusSchemaModel,
      releaseDate: z.string()
        .nullable()
        .openapi({
          description: 'Official release date of the version',
          example: '2023-10-10T00:00:00.000Z'
        }
      ),
      eoasFrom: z.string()
        .nullable()
        .openapi({
          description: 'Date when this the version only receives security updates',
          example: '2024-10-10T00:00:00.000Z'
        }
      ),
      eolFrom: z.string()
        .nullable()
        .openapi({
          description: 'Date when the version reaches end of life (no more updates)',
          example: '2025-10-10T00:00:00.000Z'
        }
      ),
      isLts: z.boolean()
        .openapi({
          description: 'Indicates if the version is a Long Term Support (LTS) release',
          example: true
        }
      ),
      isMaintained: z.boolean()
        .openapi({
          description: 'Indicates if the version is still maintained upstream',
          example: true
        }
      ),
      isEoas: z.boolean().nullable()
        .openapi({
          description: 'Indicates if the version has reached end of active support',
          example: false
        }
      ),
      isEol: z.boolean().nullable()
        .openapi({
          description: 'Indicates if the version has reached end of life',
          example: false
        }
      )
    })
    .openapi({
      description: 'Upstream version information',
      example: {
        status: 'supported',
        releaseDate: '2023-10-10T00:00:00.000Z',
        eoasFrom: '2024-10-10T00:00:00.000Z',
        eolFrom: '2025-10-10T00:00:00.000Z',
        isLts: true,
        isMaintained: true,
        isEoas: false,
        isEol: false
      }
    }
  ), // upstream
  manifest: z.object({
    endpoints: z.record(z.string(), z.object({})).nullable()
      .openapi({
        description: 'Service endpoints exposed by this image version',
        example: {
          http: {
            port: 80,
            scheme: 'http',
            default: true
          }
        }
      }),
    min_cpu_size: z.number().nullable()
      .openapi({
        description: 'Minimum required CPU size in cores',
        example: 0.1
      }),
    min_mem_size: z.number().nullable()
      .openapi({
        description: 'Minimum required memory size in MB',
        example: 64
      }),
    is_persistent: z.boolean().nullable()
      .openapi({
        description: 'Indicates if the image version supports persistent storage',
        example: null
      }),
    min_disk_size: z.number().nullable()
      .openapi({
        description: 'Minimum required disk size in MB',
        example: null
      }),
    allow_scale_up: z.boolean().nullable()
      .openapi({
        description: 'Indicates if the image version allows scaling up resources',
        example: true
      }),
    allow_scale_down: z.boolean().nullable()
      .openapi({
        description: 'Indicates if the image version allows scaling down resources',
        example: true
      }),
    storage_mount_point: z.string().nullable()
      .openapi({
        description: 'Default mount point for storage in the image version',
        example: '/mnt'
      }),
    default_container_profile: z.enum(["HIGH_CPU","BALANCED","HIGH_MEMORY","HIGHER_MEMORY"])
      .nullable() // TODO remove nullable when all images are updated
      .openapi({
        description: 'Default container profile for resource allocation',
        example: 'HIGH_CPU'
      }),
    supports_horizontal_scaling: z.boolean().nullable()
      .openapi({
        description: 'Indicates if the image version supports horizontal scaling',
        example: true
      }),
    package_version: z.object({
      raw: z.string()
        .openapi({
          description: 'the raw version string as provided by the package manager',
          example: '14.17.6-beta+exp.sha.5114f85'
        }),
      majorMinor: z.string()
        .openapi({
          description: 'the major and minor version components',
          example: '14.17'
        }),
      normalized: z.string()
        .openapi({
          description: 'the normalized version string according to semver rules',
          example: '14.17.6'
        })
      }).openapi({
        description: 'Package manager specific version information',
        example: {
          raw: '<major>.<minor>.<patch>-<prerelease>+<buildmetadata>',
          majorMinor: '14.17',
          normalized: '14.17.6'
        }
      }),
  }).openapi({
    description: 'Manifest details for the image version from Upsun registry',
    example: {
      endpoints: {
        http: {
          port: 80,
          scheme: 'http'
        }
      },
      min_cpu_size: 0.1,
      min_mem_size: 64,
      is_persistent: null,
      min_disk_size: null,
      allow_scale_up: true,
      allow_scale_down: true,
      storage_mount_point: '/mnt',
      default_container_profile: 'HIGH_CPU',
      supports_horizontal_scaling: true,
      package_version: {
        raw: '14.17.6-beta+exp.sha.5114f85',
        majorMinor: '14.17',
        normalized: '14.17.6'
      }
    }
  }), // manifest
});

/**
 * Schema for a single image in the registry
 */
export const DeployImageSchemaModel = z.object({
  name: z.string()
    .min(2)
    .max(256)
    .trim()
    .openapi({
      description: 'Image name',
      example: 'nodejs'
    }
  ),
  description: z.string()
    .max(1024) // TODO re-enable when all descriptions are fixed
    .trim()
    .optional() // TODO remove optional when all images have description
    .openapi({
      description: 'Image description',
      example: 'NodeJS service for Upsun'
    }
  ),
  need_disk: z.boolean()
    .openapi({
      description: 'Indicates if the image needs a disk storage',
      example: true
    }
  ),
  premium: z.boolean()
    .optional()
    .openapi({
      description: 'Indicates if the image is a premium service',
      example: false
  }),
  docs: z.object(
    {
      configuration: z.string().optional().openapi({
        description: 'Configuration details for the image',
        example: "    configuration:\n        vcl: !include\n            type: string\n            path: config.vcl"
      }),
      service_relationship: z.string().optional().openapi({
        description: 'Configuration details for the service relationship definition of the image',
        example: "application: \'app:http\'"
      }),
      relationship_name: z.string()
        .min(3)
        .max(36)
        .lowercase()
        .trim()
        .optional()
        .openapi({
          description: 'Used in the generated Docs as a sample for the relationship name of an image',
          example: 'database'
        }
      ),
      service_name: z.string()
        .optional()
        .openapi({
          description: 'Used in the generated Docs as a sample for the service name of an image',
          example: 'postgresql'
        }
      ),
      url: z.url()
        .startsWith('https://docs.upsun.com/')
        .openapi({
          description: 'Documentation URL',
          example: 'https://docs.upsun.com/languages/nodejs'
        }
      ),
      web: z.object({}).optional().openapi({
        description: 'Web configuration for this image',
        example: {
          commands: {
            start: './target/debug/hello'
          },
          locations: {
            '/': {
              root: 'wwwroot',
              allow: true,
              passthru: true
            }
          }
        }
      }),
      hooks: z.object({
        build: z.array(z.string()).optional(),
        deploy: z.array(z.string()).optional(),
        post_deploy: z.array(z.string()).optional(),
      }).optional().openapi({
        description: 'Hook scripts for this image',
        example: {
          build: ['npm install', 'npm run build']
        }
      }),
      build: z.object({}).optional().openapi({
        description: 'Build configuration for this image',
        example: {
          flavor: 'composer'
        }
      })
    })
    .openapi({
      description: 'Image documentation details',
      example: {
        "relationship_name": "nodejs",
        "service_name": "nodejs",
        "url": "https://docs.upsun.com/languages/nodejs.html",
        "web": "        locations: {\n          \"/\": {\n            root: 'wwwroot',\n            allow: true,\n            passthru: true\n          }\n        },\n "
      }
    }),
  internal: z.object({
    repo_name: z.string()
      //.min(3)
      //.trim()
      .openapi({
        description: 'Internal properties for the image, used only by Upsun',
        example: 'nodejs'
      })
    })
    .openapi({
      description: 'Internal properties for the image, used only by Upsun',
      example: {
        repo_name: 'nodejs'
      }
  }),
  runtime: z.boolean()
    .openapi({
      description: 'Indicates if the image is a runtime image (true)',
      example: true
    }
  ),
  service: z.boolean()
    .openapi({
      description: 'Indicates if the image is a service image (true)',
      example: true
    }
  ),
  versions:z.record(
    z.string().openapi('versionId').describe('Unique identifier for a version (e.g., 14, 16, 18)'),
    DeployImageVersionSchemaModel
  ),
  _links: LinkSchema.optional().openapi({
    description: 'Hypermedia links related to this image',
    example: {
      self: 'https://meta.upsun.com/image/nodejs'
    }
  })
}).openapi({
  description: 'Schema representing a single image in the Upsun image registry.'
});

/**
 * Schema for Images Registry (list of images)
 */
export const DeployImageListSchemaModel = z.record(
  z.string().openapi('imageId').describe('Unique identifier for an image (e.g., nodejs, php, python)'),
  DeployImageSchemaModel
).openapi('DeployImageListModel', {
  "x-internal": true, // Mark as internal to exclude from public API docs
  description: 'Registry containing all available images (see [DeployImage](#/model/DeployImage) for the full structure).'
});


// ========================================
// DTOs
// ========================================

export const DeployImageSchemaDtoPublic =
  DeployImageSchemaModel
    .openapi('DeployImage', {"x-internal": false});


export const DeployImageSchemaDtoInternal =
  DeployImageSchemaModel
    .openapi({"x-internal": true});


export const DeployImageListSchemaDtoPublic = z.record(
  z.string().openapi('imageId').describe('Unique identifier for an image (e.g., nodejs, php, python)'),
  DeployImageSchemaModel
    .omit({ docs: true, internal: true, runtime:true })
    .extend({
        versions: z.record(
          z.string().openapi('versionId').describe('Unique identifier for a version (e.g., 14, 16, 18)'),
          DeployImageVersionSchemaModel
            .omit({
              upstream: true,
              manifest: true,
            })
            .extend({
              upsun: DeployImageVersionSchemaModel.shape.upsun.omit({
                internal_support: true
              })
            })
        ),
      })
).openapi('DeployImageList', {
  "x-internal": false,
  description: 'Registry containing all available images (see [DeployImage](#/model/DeployImage) for the full structure).'
});

/**
 * Schema for Images Registry (list of images)
 */
export const DeployImageListSchemaDtoInternal = z.record(
  z.string().openapi('imageId').describe('Unique identifier for an image (e.g., nodejs, php, python)'),
  DeployImageSchemaModel
).openapi({
  "x-internal": true, // Mark as internal to exclude from public API docs
});

// Type exports for TypeScript
export type DeployImageListDto = z.infer<typeof DeployImageListSchemaDtoInternal> | z.infer<typeof DeployImageListSchemaDtoPublic>
export type DeployImageDto = z.infer<typeof DeployImageSchemaDtoInternal> | z.infer<typeof DeployImageSchemaDtoPublic>;
