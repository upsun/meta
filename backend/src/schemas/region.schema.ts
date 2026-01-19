import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

// Extend Zod with OpenAPI
extendZodWithOpenApi(z);

/**
 * Schema for a single region
 */
export const RegionSchema = z.object({
  name: z.string().openapi({
    description: 'Region name',
    example: 'us-2.platform.sh'
  }),
  provider: z.string().openapi({
    description: 'Cloud provider',
    example: 'AWS'
  }),
  zone: z.string().openapi({
    description: 'Geographic zone',
    example: 'North America'
  }),
  timezone: z.string().openapi({
    description: 'Timezone identifier',
    example: 'America/New_York'
  })
}).passthrough().openapi('Region');

/**
 * Schema for the complete regions list
 */
export const RegionsListSchema = z.array(RegionSchema).openapi('RegionsList', {
  description: 'Complete list of all available regions',
  example: [
    {
      name: 'us-2.platform.sh',
      provider: 'AWS',
      zone: 'North America',
      timezone: 'America/New_York'
    },
    {
      name: 'eu.platform.sh',
      provider: 'AWS',
      zone: 'Europe',
      timezone: 'Europe/Dublin'
    }
  ]
});

/**
 * Schema for region count response
 */
export const RegionCountSchema = z.object({
  count: z.number().openapi({
    description: 'Total number of available regions',
    example: 15
  })
}).openapi('RegionCount');

/**
 * Schema for error responses
 */
export const RegionErrorSchema = z.object({
  error: z.string().openapi({
    description: 'Error message',
    example: 'Region not found'
  }),
  availableRegions: z.array(z.string()).optional().openapi({
    description: 'List of available region names',
    example: ['us-2.platform.sh', 'eu.platform.sh', 'au.platform.sh']
  }),
  availableProviders: z.array(z.string()).optional().openapi({
    description: 'List of available providers (for provider filters)',
    example: ['AWS', 'Azure', 'Google']
  }),
  availableZones: z.array(z.string()).optional().openapi({
    description: 'List of available zone names',
    example: ['North America', 'Europe', 'Australia']
  }),
  availableCountryCodes: z.array(z.string()).optional().openapi({
    description: 'List of available ISO country codes (for country_code filter)',
    example: ['US', 'CA', 'AU']
  }),
  availableProperties: z.array(z.string()).optional().openapi({
    description: 'List of available properties for a region',
    example: ['name', 'provider', 'zone', 'timezone']
  })
}).openapi('RegionError');

// ======================================================================== //
// Host region schema & examples
// ======================================================================== //

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const hostRegionsJsonPath = path.resolve(__dirname, '../../../resources/host/regions.json');

const fallbackHostRegions = [
  {
    id: 'au',
    label: 'Australia (au)',
    name: 'au.platform.sh',
    zone: 'Australia',
    timezone: 'Australia/Sydney',
    location_guarantee: false,
    available: true,
    private: false,
    note: null,
    provider: {
      name: 'AWS',
      logo: 'SVG_PLACEHOLDER'
    },
    datacenter: {
      name: 'ap-southeast-2',
      label: 'AWS Asia Pacific Sydney',
      location: 'Sydney, Australia'
    },
    environmental_impact: {
      country_code: 'AU',
      carbon_intensity: 545,
      green: false
    },
    outbound_ips: ['13.54.121.225'],
    inbound_ips: ['13.54.222.56'],
    inbound_location: 'gw.au',
    compliance: {
      hipaa: false
    },
    create_date: '2024-10-21T16:09:17.273Z',
    update_date: '2024-10-21T16:09:17.273Z',
    eol_date: null
  },
  {
    id: 'eu',
    label: 'Europe (eu)',
    name: 'eu.platform.sh',
    zone: 'Europe',
    timezone: 'Europe/Dublin',
    location_guarantee: true,
    available: true,
    private: false,
    note: 'EU primary region',
    provider: {
      name: 'AWS',
      logo: 'SVG_PLACEHOLDER'
    },
    datacenter: {
      name: 'eu-west-1',
      label: 'AWS Europe (Ireland)',
      location: 'Dublin, Ireland'
    },
    environmental_impact: {
      country_code: 'IE',
      carbon_intensity: 210,
      green: true
    },
    outbound_ips: ['3.8.1.1'],
    inbound_ips: ['3.8.2.1'],
    inbound_location: 'gw.eu',
    compliance: {
      hipaa: true
    },
    create_date: '2023-12-01T12:00:00.000Z',
    update_date: '2024-05-01T12:00:00.000Z',
    eol_date: null
  }
];

const providerFilterValues = ['AWS', 'Azure', 'Google', 'OVH', 'none'] as const;
const zoneFilterValues = ['Australia', 'Europe', 'North America'] as const;
const countryCodeFilterValues = ['AU', 'CA', 'CH', 'DE', 'FR', 'GB', 'IE', 'SE', 'US', 'none'] as const;
const regionFilterFieldValues = ['name', 'provider', 'zone', 'country_code'] as const;

export const RegionFilterFieldEnum = z.enum(regionFilterFieldValues).openapi('RegionFilterField', {
  description: 'Allowed query filter names that can be passed to /region',
  example: 'provider'
});

export const RegionProviderEnum = z.enum(providerFilterValues).openapi('RegionProvider', {
  description: 'Provider enum derived from the available host regions',
  example: 'AWS'
});

export const RegionZoneEnum = z.enum(zoneFilterValues).openapi('RegionZone', {
  description: 'Zone enum derived from the available host regions',
  example: 'North America'
});

export const RegionCountryCodeEnum = z.enum(countryCodeFilterValues).openapi('RegionCountryCode', {
  description: 'ISO country code enum derived from host regions',
  example: 'US'
});

const hostRegionExamplePool = (() => {
  try {
    const raw = fs.readFileSync(hostRegionsJsonPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const listExample = parsed.slice(0, 2);
      return {
        single: parsed[0],
        list: listExample.length ? listExample : [parsed[0]]
      };
    }
  } catch {
    // Fall back to the trimmed sample when the resource file is unavailable.
  }
  return {
    single: fallbackHostRegions[0],
    list: fallbackHostRegions
  };
})();

const hostRegionExample = hostRegionExamplePool.single as Record<string, any>;
const hostRegionsListExample = hostRegionExamplePool.list as Record<string, any>[];
const providerExample = (hostRegionExample?.provider ?? {}) as Record<string, any>;
const datacenterExample = (hostRegionExample?.datacenter ?? {}) as Record<string, any>;
const environmentalExample = (hostRegionExample?.environmental_impact ?? {}) as Record<string, any>;
const complianceExample = (hostRegionExample?.compliance ?? {}) as Record<string, any>;
const outboundIpsExample = hostRegionExample?.outbound_ips ?? ['13.54.121.225'];
const inboundIpsExample = hostRegionExample?.inbound_ips ?? ['13.54.222.56'];
const inboundLocationExample = hostRegionExample?.inbound_location ?? 'gw.au';
const noteExample = hostRegionExample?.note ?? null;
const eolDateExample = hostRegionExample?.eol_date ?? null;

export const HostRegionSchema = z.object({
  id: z.string().openapi({
    description: 'Region identifier',
    example: hostRegionExample?.id ?? 'au'
  }),
  label: z.string().openapi({
    description: 'Human-readable label for the region',
    example: hostRegionExample?.label ?? 'Australia (au)'
  }),
  name: z.string().openapi({
    description: 'Fully qualified region domain',
    example: hostRegionExample?.name ?? 'au.platform.sh'
  }),
  zone: z.string().openapi({
    description: 'Geographic zone',
    example: hostRegionExample?.zone ?? 'Australia'
  }),
  timezone: z.string().openapi({
    description: 'Timezone identifier',
    example: hostRegionExample?.timezone ?? 'Australia/Sydney'
  }),
  location_guarantee: z.boolean().openapi({
    description: 'Whether the region carries a location guarantee',
    example: hostRegionExample?.location_guarantee ?? false
  }),
  available: z.boolean().openapi({
    description: 'Is the region currently available',
    example: hostRegionExample?.available ?? true
  }),
  private: z.boolean().openapi({
    description: 'Is the region private',
    example: hostRegionExample?.private ?? false
  }),
  note: z.string().nullable().optional().openapi({
    description: 'Optional administrative note',
    example: noteExample
  }),
  provider: z.object({
    name: z.string().openapi({
      description: 'Provider name',
      example: providerExample?.name ?? 'AWS'
    }),
    logo: z.string().openapi({
      description: 'Embedded provider logo (SVG/base64)',
      example: providerExample?.logo ?? 'SVG_PLACEHOLDER'
    })
  }).openapi('HostRegionProvider'),
  datacenter: z.object({
    name: z.string().openapi({
      description: 'Datacenter identifier',
      example: datacenterExample?.name ?? 'ap-southeast-2'
    }),
    label: z.string().openapi({
      description: 'Datacenter label',
      example: datacenterExample?.label ?? 'AWS Asia Pacific Sydney'
    }),
    location: z.string().openapi({
      description: 'Datacenter physical location',
      example: datacenterExample?.location ?? 'Sydney, Australia'
    })
  }).openapi('HostRegionDatacenter'),
  environmental_impact: z.object({
    country_code: z.string().openapi({
      description: 'Country code ISO',
      example: environmentalExample?.country_code ?? 'AU'
    }),
    carbon_intensity: z.number().openapi({
      description: 'Carbon intensity (gCO2/kWh)',
      example: environmentalExample?.carbon_intensity ?? 545
    }),
    green: z.boolean().openapi({
      description: 'Is the region green certified',
      example: environmentalExample?.green ?? false
    })
  }).openapi('HostRegionEnvironmentalImpact'),
  outbound_ips: z.array(z.string()).openapi({
    description: 'Public outbound IP addresses',
    example: outboundIpsExample
  }),
  inbound_ips: z.array(z.string()).openapi({
    description: 'Public inbound IP addresses',
    example: inboundIpsExample
  }),
  inbound_location: z.string().nullable().optional().openapi({
    description: 'Inbound gateway alias',
    example: inboundLocationExample
  }),
  compliance: z.object({
    hipaa: z.boolean().openapi({
      description: 'HIPAA compliance flag',
      example: complianceExample?.hipaa ?? false
    })
  }).passthrough().openapi('HostRegionCompliance'),
  create_date: z.string().openapi({
    description: 'Creation timestamp',
    example: hostRegionExample?.create_date ?? '2024-10-21T16:09:17.273Z'
  }),
  update_date: z.string().openapi({
    description: 'Last update timestamp',
    example: hostRegionExample?.update_date ?? '2024-10-21T16:09:17.273Z'
  }),
  eol_date: z.string().nullable().optional().openapi({
    description: 'End-of-life timestamp',
    example: eolDateExample
  })
}).passthrough().openapi('HostRegion', {
  description: 'Detailed host region metadata mirrored from resources/host/regions.json',
  example: hostRegionExample
});

export const HostRegionsListSchema = z.array(HostRegionSchema).openapi('HostRegionsList', {
  description: 'Complete list of host region metadata entries',
  example: hostRegionsListExample
});

export type HostRegion = z.infer<typeof HostRegionSchema>;
export type HostRegionsList = z.infer<typeof HostRegionsListSchema>;
export type RegionFilterField = z.infer<typeof RegionFilterFieldEnum>;
export type RegionProvider = z.infer<typeof RegionProviderEnum>;
export type RegionZone = z.infer<typeof RegionZoneEnum>;
export type RegionCountryCode = z.infer<typeof RegionCountryCodeEnum>;
