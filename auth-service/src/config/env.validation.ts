const MIN_KEY_LENGTH = 32;

/** Fails fast at startup instead of at the first request. */
export const validateEnv = (
  env: Record<string, unknown>,
): Record<string, unknown> => {
  const key = env.PRIVATE_KEY;
  if (typeof key !== 'string' || key.length < MIN_KEY_LENGTH) {
    throw new Error(
      `PRIVATE_KEY is required and must be at least ${MIN_KEY_LENGTH} characters`,
    );
  }
  if (typeof env.MONGO_URI !== 'string' || env.MONGO_URI.length === 0) {
    throw new Error('MONGO_URI is required (see .env.example)');
  }
  return env;
};
