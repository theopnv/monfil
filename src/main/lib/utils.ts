/**
 * Runs `worker` over every item, never more than `limit` at a time.
 * It throws after all items have been attempted if a worker failed.
 * @param items the list of items to run the worker onto
 * @param limit the max number concurrent runs
 * @param worker the function to run
 * @returns a promise that settles when the last item is done
 */
export async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const errors: unknown[] = [];

  async function run(): Promise<void> {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      if (item === undefined) {
        continue;
      }
      try {
        await worker(item);
      } catch (error) {
        errors.push(error);
      }
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => run()));

  if (errors.length === 1) {
    throw errors[0];
  }
  if (errors.length > 1) {
    throw new AggregateError(errors, 'Multiple workers failed');
  }
}
