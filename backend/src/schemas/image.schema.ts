import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

// Extend Zod with OpenAPI
extendZodWithOpenApi(z);

/**
 * Schema for Images Registry  
 */
export const ImageVersionStatusSchema = z.enum(['supported', 'deprecated', 'retired'])
  .openapi({  
    description: 'Status of the image version, following official lifecycle.', //TODO add description for each possible status
    example: 'supported'
  }) 
;

/**
 * Schema for Image Version
 */
export const ImageVersionSchema = z.object({
  name: z.string().min(1).openapi({
    description: 'Version name',
    example: '14'
  }),
  upsun: z.object({
    status: ImageVersionStatusSchema,
    internal_support: z.boolean()
      .openapi({
        description: 'Indicates if the version has support from Upsun',
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
      status: ImageVersionStatusSchema,
      release_date: z.coerce.date()
        .nullable()
        .openapi({
          description: 'Official release date of the version',
          example: '2023-10-10T00:00:00.000Z'
        }
      ),
      end_of_active_support_date: z.coerce.date()
        .nullable()
        .openapi({
          description: 'Date when this the version only receives security updates',
          example: '2024-10-10T00:00:00.000Z'
        }
      ),
      end_of_life_date: z.coerce.date()
        .nullable()
        .openapi({
          description: 'Date when the version reaches end of life (no more updates)',
          example: '2025-10-10T00:00:00.000Z'
        }
      ),
      is_lts: z.boolean()
        .openapi({
          description: 'Indicates if the version is a Long Term Support (LTS) release',
          example: true
        }
      ),
      is_maintained: z.boolean()
        .openapi({
          description: 'Indicates if the version is still maintained upstream',
          example: true
        }
      ),
      is_end_of_active_support: z.boolean().nullable()
        .openapi({
          description: 'Indicates if the version has reached end of active support',
          example: false
        }
      ),
      is_end_of_life: z.boolean().nullable()
        .openapi({
          description: 'Indicates if the version has reached end of life',
          example: false
        }
      ),
      is_long_term_support: z.boolean().nullable()
        .openapi({
          description: 'Indicates if the version is designated as long term support',
          example: true
        }
      )
    })
    .openapi({
      description: 'Upstream version information',
      example: {
        status: 'supported',
        release_date: '2023-10-10T00:00:00.000Z',
        end_of_active_support_date: '2024-10-10T00:00:00.000Z',
        end_of_life_date: '2025-10-10T00:00:00.000Z',
        is_lts: true,
        is_maintained: true,
        is_end_of_active_support: false,
        is_end_of_life: false,
        is_long_term_support: true
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
            scheme: 'http'
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
      })
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
      supports_horizontal_scaling: true
    } 
  }) // manifest
}).openapi('VersionImage');

/**
 * Schema for a single image in the registry
 */
export const ImageSchema = z.object({
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
  versions: z.array(ImageVersionSchema).min(1),
  

}).openapi('Image'); // passthrough to allow additional properties

/**
 * Schema for Images Registry (list of images)
 */
export const ImagesSchema = z.record(z.string(), ImageSchema).openapi('Images', {
  description: 'Registry containing all available images',
  example: {
    'nodejs': {
      name: "JavaScript/Node.js",
      endpoint: 'https://meta.upsun.com/image',
      type: 'runtime',
      description: "NodeJS service for Upsun",
      repo_name: "nodejs",
      docs: {
        "relationship_name": "nodejs",
        "service_name": "nodejs",
        "url": "https://docs.upsun.com/languages/nodejs.html",
        "web": {
          "commands": {
            "start": "node index.js"
          }
        }
      },
      min_disk_size: null,
      runtime: true,
      need_disk: false,
      versions: [
        {
          "name": "24",
          "upsun": {"status": "supported", "internal_support": true},
          "upstream": {"status": "supported","release_date": "2025-05-06T00:00:00.000Z","end_of_active_support_date": "2026-10-20T00:00:00.000Z","end_of_life_date": "2028-04-30T00:00:00.000Z","is_lts": true,"is_maintained": true,"is_end_of_active_support": false,"is_end_of_life": false,"is_long_term_support": true},
          "manifest": {"endpoints": {"http": {"port": 80,"scheme": "http"}},"min_cpu_size": 0.1,"min_mem_size": 64,"is_persistent": null,"min_disk_size": null,"allow_scale_up": true,"allow_scale_down": true,"storage_mount_point": "/mnt","default_container_profile": "HIGH_CPU","supports_horizontal_scaling": true}
        },
        {
          "name": "22",
          "upsun": {"status": "deprecated","internal_support": true},
          "upstream": {"status": "deprecated","release_date": "2024-04-24T00:00:00.000Z","end_of_active_support_date": "2025-10-21T00:00:00.000Z","end_of_life_date": "2027-04-30T00:00:00.000Z","is_lts": true,"is_maintained": true,"is_end_of_active_support": true,"is_end_of_life": false,"is_long_term_support": true},
          "manifest": {"endpoints": {"http": {"port": 80,"scheme": "http"}},"min_cpu_size": 0.1,"min_mem_size": 64,"is_persistent": null,"min_disk_size": null,"allow_scale_up": true,"allow_scale_down": true,"storage_mount_point": "/mnt","default_container_profile": "HIGH_CPU","supports_horizontal_scaling": true} 
        }
      ]
    }
  }
});


// Type exports for TypeScript
export type ImagesRegistry = z.infer<typeof ImagesSchema>;
export type ImageRegistry = z.infer<typeof ImageSchema>;
