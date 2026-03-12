import { z, type ZodRawShape } from 'zod';

import { loadEnvFile } from './dotenv';

export function readEnv<TShape extends ZodRawShape>(schemaShape: TShape): z.infer<z.ZodObject<TShape>> {
  loadEnvFile();
  const schema = z.object(schemaShape);
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid environment variables: ${issues}`);
  }

  return parsed.data;
}
