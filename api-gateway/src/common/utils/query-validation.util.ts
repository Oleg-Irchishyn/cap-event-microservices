import { toStringArray } from './rpc-call.util';

/** `YYYY-MM-DD` (the `date` format of the specs). */
export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The generated UI client sends `''` for dates it could not resolve
 * (formatDate(null)), so request bodies accept an empty string too.
 */
export const DATE_OR_EMPTY_REGEX = /^(\d{4}-\d{2}-\d{2})?$/;

/** class-transformer hook: repeated or single query parameters become an array. */
export const queryArray = ({ value }: { value: unknown }): unknown =>
  toStringArray(value) ?? value;
