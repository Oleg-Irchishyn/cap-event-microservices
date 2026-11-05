type Doc = Record<string, any>;

/** In-memory stand-in for the few Mongoose Model methods CapEventsService uses. */
export const fakeModel = () => {
  const store: Doc[] = [];
  const matches = (doc: Doc, filter: Doc): boolean =>
    Object.entries(filter).every(([key, cond]) =>
      cond && typeof cond === 'object' && '$in' in cond
        ? (cond as { $in: unknown[] }).$in.includes(doc[key])
        : doc[key] === cond,
    );
  const lean = <T>(value: T) => ({ lean: () => Promise.resolve(value) });

  return {
    store,
    create: jest.fn((doc: Doc) => {
      store.push({ ...doc });
      return Promise.resolve(doc);
    }),
    findOne: jest.fn((filter: Doc) => {
      const found = store.find((d) => matches(d, filter));
      return lean(found ? { ...found } : null);
    }),
    exists: jest.fn((filter: Doc) =>
      Promise.resolve(
        store.some((d) => matches(d, filter)) ? { _id: 1 } : null,
      ),
    ),
    find: jest.fn((filter: Doc) => {
      let result = store
        .filter((d) => matches(d, filter))
        .map((d) => ({ ...d }));
      const chain = {
        sort: () => {
          result = result.sort((a, b) =>
            String(b.modifiedAt).localeCompare(String(a.modifiedAt)),
          );
          return chain;
        },
        lean: () => Promise.resolve(result),
      };
      return chain;
    }),
    updateOne: jest.fn((filter: Doc, update: { $set: Doc }) => {
      const found = store.find((d) => matches(d, filter));
      if (found) Object.assign(found, update.$set);
      return Promise.resolve({});
    }),
    deleteOne: jest.fn((filter: Doc) => {
      const index = store.findIndex((d) => matches(d, filter));
      if (index >= 0) store.splice(index, 1);
      return Promise.resolve({});
    }),
  };
};

export const rpcStatus = async (
  promise: Promise<unknown> | (() => unknown),
): Promise<unknown> => {
  try {
    await (typeof promise === 'function' ? promise() : promise);
  } catch (e) {
    return (e as { getError: () => unknown }).getError();
  }
  throw new Error('expected rejection');
};
