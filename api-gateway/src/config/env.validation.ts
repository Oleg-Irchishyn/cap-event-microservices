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
  if (typeof env.CLIENT_ID !== 'string' || env.CLIENT_ID.length === 0) {
    throw new Error('CLIENT_ID is required (see .env.example)');
  }
  return env;
};
