import { config } from '../config/env.config.js';
import { imageRouter } from './image.routes.js';

export const BaseSpec = (appVersion: string) => { return imageRouter.generateOpenApiSpec({
  title: 'Upsun Meta Registry API',
  version: appVersion,
  description: `
## Description

REST API to access Upsun reference information from the official registry.

> **Disclaimer:** This tool is in a BETA version. While we strive for accuracy, data may not be complete or up-to-date. Use at your own discretion.

---

## Features

- 📋 **Complete lists**: Retrieval of all available images, PHP extensions and regions
- 🔍 **Search by name**: Access to specific image or region information
- ✅ **Zod validation**: Automatic data schema validation
- 📊 **Rate limiting**: Protection against abuse
- 🌐 **CORS configured**: Cross-origin request support
- 📝 **Structured logs**: Logging with Pino for monitoring

---

## Accepted Formats

- \`application/json\` (default)
- \`application/x-yaml\`

Use the \`Accept\` header to specify your preferred format.

---

## Rate Limiting

- **General**: 100 requests per 15 minutes
- **Strict**: 10 requests per minute (if configured)
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
