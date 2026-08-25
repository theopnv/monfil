// Result
type Success<S> = { success: true; data: S };
type Failure<E> = { success: false; error: E };

export type Result<S, E = Error> = Success<S> | Failure<E>;

/**
 * Runs `worker` over every item, never more than `limit` at a time, and resolves once they have all settled.
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

  async function run(): Promise<void> {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      if (item === undefined) {
        continue;
      }
      await worker(item);
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => run()));
}
