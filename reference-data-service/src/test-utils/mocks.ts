/** Mongoose query stand-in: select/sort return the chain, lean resolves with `result`. */
export const chain = (result: unknown) => {
  const c: Record<string, jest.Mock> = {};
  c.select = jest.fn(() => c);
  c.sort = jest.fn(() => c);
  c.lean = jest.fn(() => Promise.resolve(result));
  return c;
};

/** Minimal model mock; each test configures only what it needs. */
export const mockModel = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  exists: jest.fn(),
  distinct: jest.fn(),
  bulkWrite: jest.fn(),
});

export const rpcStatus = async (
  promise: Promise<unknown>,
): Promise<unknown> => {
  try {
    await promise;
  } catch (e) {
    return (e as { getError: () => unknown }).getError();
  }
  throw new Error('expected rejection');
};
