import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const LinkSchema = z.object({
  self: z.string().describe('URL to fetch the resource')
});
