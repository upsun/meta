import { config } from '../config/env.config.js';
import { imageRouter } from './image.routes.js';

export const BaseSpec = (appVersion: string) => { return imageRouter.generateOpenApiSpec({
  title: 'Upsun Meta Registry API',
  version: appVersion,
  description: `
## Description

REST API to access Upsun reference information from the official registry.

This comprehensive API provides developers with programmatic access to essential Upsun platform metadata, including container images, PHP extensions, geographic regions, and validation schemas. Designed for automation, CI/CD pipelines, and infrastructure-as-code workflows.

> **Disclaimer:** This tool is in a BETA version. While we strive for accuracy, data may not be complete or up-to-date. Use at your own discretion.

---

## Features

- 📋 **Complete lists**: Retrieval of all available images, PHP extensions and regions with detailed metadata
- 🔍 **Search by name**: Access to specific image or region information with precise filtering capabilities
- ✅ **Validation**: Automatic data schema validation ensuring data integrity and consistency
- 📊 **Rate limiting**: Protection against abuse with configurable throttling policies
- 🌐 **CORS configured**: Cross-origin request support for seamless frontend integration
- 📝 **Structured logs**: Logging with Pino for monitoring, debugging and audit trails
- 🔄 **Multiple formats**: Support for JSON and YAML response formats
- 🚀 **High performance**: Optimized response times with efficient data retrieval
- 📖 **OpenAPI compliant**: Full OpenAPI 3.0 specification for easy client generation

---

## Use Cases

### DevOps & Infrastructure
- Automate image selection in deployment scripts
- Validate configuration files against available resources
- Generate infrastructure documentation from live data
- Monitor availability of specific images or regions

### Development & Testing
- Integrate region selection in application configuration
- Validate PHP extension compatibility before deployment
- Build dynamic deployment wizards or configurators
- Test application behavior across different regions

### Documentation & Compliance
- Generate up-to-date reference documentation
- Audit available resources for compliance requirements
- Track changes in available images and extensions
- Maintain inventory of platform capabilities

---

## Quick Start

### Get all available images
\`\`\`bash
curl -X GET "${config.server.BASE_URL}/images" \\
  -H "Accept: application/json"
\`\`\`

### Search for a specific image
\`\`\`bash
curl -X GET "${config.server.BASE_URL}/images/php" \\
  -H "Accept: application/json"
\`\`\`

### Get regions in YAML format
\`\`\`bash
curl -X GET "${config.server.BASE_URL}/regions" \\
  -H "Accept: application/x-yaml"
\`\`\`

---

## Accepted Formats

The API supports multiple response formats. Specify your preferred format using the \`Accept\` header:

- \`application/json\` (default) - Standard JSON format, ideal for programmatic consumption
- \`application/x-yaml\` - YAML format, human-readable and configuration-friendly

**Example:**
\`\`\`bash
# Request JSON response
curl -H "Accept: application/json" ${config.server.BASE_URL}/images

# Request YAML response
curl -H "Accept: application/x-yaml" ${config.server.BASE_URL}/images
\`\`\`

---

## Rate Limiting

To ensure fair usage and service stability, the API implements rate limiting:

- **General limit**: 100 requests per 15 minutes per IP address
- **Strict limit**: 10 requests per minute (if configured for specific endpoints)

When you exceed the rate limit, you'll receive a \`429 Too Many Requests\` response with a \`Retry-After\` header indicating when you can retry.

**Best practices:**
- Cache responses when possible to reduce API calls
- Implement exponential backoff for retries
- Monitor your usage patterns and adjust accordingly
- Contact support if you need higher limits for production use

---

## Response Codes

| Code | Status | Description |
|------|--------|-------------|
| 200 | Success | Request completed successfully |
| 400 | Bad Request | Invalid request parameters or format |
| 404 | Not Found | Requested resource does not exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Internal server error |

---

## Support & Resources

- 📚 **Documentation**: [GitHub Repository](https://github.com/upsun/meta)
- 🐛 **Issues**: [Report a bug](https://github.com/upsun/meta/issues)
- 💬 **Discussions**: [Community forum](https://github.com/upsun/meta/discussions)
- 📧 **Contact**: Advocacy team

---

## Data Freshness

The API serves data from regularly updated registries:
- **Images**: Updated with each platform release
- **Extensions**: Synchronized with PHP version availability
- **Regions**: Reflects current infrastructure deployment
- **Validation schemas**: Maintained alongside platform updates

For the most critical operations, we recommend implementing periodic data refresh in your applications.
  `,
  contact: {
    name: 'API Support',
    url: 'https://github.com/upsun/meta/issues',
  },
  license: {
    name: 'MIT',
    url: 'https://opensource.org/licenses/MIT'
  },
  servers: [
    {
      url: config.server.BASE_URL,
      description: config.isDevelopment() ? 'Development server' : 'Production server'
    }
  ]
});
}
