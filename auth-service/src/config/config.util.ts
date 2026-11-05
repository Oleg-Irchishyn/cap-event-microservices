import type { ConfigService } from '@nestjs/config';

export const readPositiveInt = (
  config: ConfigService,
  key: string,
  fallback: number,
): number => {
  const raw = config.get<string | number>(key);
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};
