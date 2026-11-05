/** Fails fast at startup instead of at the first request. */
export const validateEnv = (
  env: Record<string, unknown>,
): Record<string, unknown> => {
  if (typeof env.MONGO_URI !== 'string' || env.MONGO_URI.length === 0) {
    throw new Error('MONGO_URI is required (see .env.example)');
  }
  return env;
};
