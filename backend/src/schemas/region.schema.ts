import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { LinkSchema } from './links.schema.js';

// Extend Zod with OpenAPI
extendZodWithOpenApi(z);

export const HostRegionSchema = z.object({
  id: z.string().lowercase().openapi({
    description: 'Region Upsun identifier',
    example: 'au'
  }),
  label: z.string().min(3).openapi({
    description: 'Human-readable label for the region',
    example: 'Australia (au)'
  }),
  name: z.hostname().openapi({
    description: 'Fully qualified region hostname',
    example: 'au.platform.sh'
  }),
  zone: z.string().min(3).openapi({
    description: 'Geographic zone',
    example: 'Australia'
  }),
  country_code: z.string().length(2).uppercase().openapi({
    description: 'Country code ISO',
    example: 'AU'
  }),
  timezone: z.string().openapi({
    description: 'Timezone identifier',
    example: 'Australia/Sydney'
  }),
  location_guarantee: z.boolean().openapi({
    description: 'Whether the region carries a location guarantee',
    example: false
  }),
  available: z.boolean().openapi({
    description: 'Is the region currently available',
    example: true
  }),
  private: z.boolean().openapi({
    description: 'Is the region private',
    example: false
  }),
  note: z.string().nullable().openapi({
    description: 'Optional administrative note',
    example: null
  }),
  provider: z.object({
    name: z.string().openapi({
      description: 'Provider name',
      example: 'AWS'
    }),
    logo: z.base64().openapi({
      description: 'Embedded provider logo (SVG/base64)',
      example: 'SVG_PLACEHOLDER'
    })
  }).openapi({
    description: 'Cloud provider metadata',
  }),
  datacenter: z.object({
    name: z.string().openapi({
      description: 'Datacenter identifier',
      example: 'ap-southeast-2'
    }),
    label: z.string().openapi({
      description: 'Datacenter label',
      example: 'AWS Asia Pacific Sydney'
    }),
    location: z.string().openapi({
      description: 'Datacenter physical location',
      example: 'Sydney, Australia'
    })
  }).openapi({
    description: 'Datacenter metadata',
  }),
  environmental_impact: z.object({
    carbon_intensity: z.number().openapi({
      description: 'Carbon intensity (gCO2/kWh)',
      example: 545
    }),
    green: z.boolean().openapi({
      description: 'Is the region green certified',
      example: false
    })
  }).openapi({
    description: 'Environmental impact metadata',
  }),
  outbound_ips: z.array(z.ipv4()).openapi({
    description: 'Public outbound IP addresses',
    example: "8.8.8.8"
  }),
  inbound_ips: z.array(z.ipv4()).openapi({
    description: 'Public inbound IP addresses',
    example: "8.8.4.4"
  }),
  inbound_location: z.string().nullable().openapi({
    description: 'Inbound gateway alias',
    example: "gw.au"
  }),
  compliance: z.object({
    hipaa: z.boolean().openapi({
      description: 'HIPAA compliance flag',
      example: false
    })
  }).openapi({
    description: 'Compliance certifications metadata',
  }),
  create_date: z.coerce.date().openapi({
    description: 'Creation timestamp',
    example: '2024-10-21T16:09:17.273Z'
  }),
  update_date: z.coerce.date().openapi({
    description: 'Last update timestamp',
    example: '2024-10-21T16:09:17.273Z'
  }),
  eol_date: z.string().nullable().openapi({
    description: 'End-of-life timestamp',
    example: null
  }),
  _links: LinkSchema.optional().openapi({
    description: 'Hypermedia links related to this region',
    example: {
      self: 'https://meta.upsun.com/region/us-2'
    }
  })
}).openapi('HostRegion', {
  description: 'Detailed host region metadata mirrored from resources/host/regions.json',
});

export const HostRegionsListSchema = z.array(HostRegionSchema)
  .openapi({
    description: 'Complete list of host region metadata entries'
  });

const providerFilterValues = ['AWS', 'Azure', 'Google', 'OVH', 'none'] as const;
const zoneFilterValues = ['Australia', 'Europe', 'North America'] as const;
const countryCodeFilterValues = ['AU', 'CA', 'CH', 'DE', 'FR', 'GB', 'IE', 'SE', 'US', 'none'] as const;
const regionFilterFieldValues = ['name', 'provider', 'zone', 'country_code'] as const;

export type HostRegion = z.infer<typeof HostRegionSchema>;
export type HostRegionsList = z.infer<typeof HostRegionsListSchema>;
