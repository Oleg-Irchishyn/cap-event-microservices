import { validateEnv } from '../env.validation';

describe('validateEnv', () => {
  it('requires MONGO_URI', () => {
    expect(() => validateEnv({})).toThrow('MONGO_URI is required');
  });

  it('accepts a configured environment', () => {
    const env = { MONGO_URI: 'mongodb://localhost/x' };
    expect(validateEnv(env)).toBe(env);
  });
});
