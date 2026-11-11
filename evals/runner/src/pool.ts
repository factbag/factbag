/**
 * Run work over a list with a fixed number of requests in flight. Node has no bounded
 * concurrency primitive: `Promise.all` starts everything at once, and the stream
 * iterator helpers are still experimental.
 */
export async function pool<T>(
  items: readonly T[],
  concurrency: number,
  work: (item: T, index: number) => Promise<void>,
): Promise<void> {
  const queue = [...items.entries()];
  const worker = async (): Promise<void> => {
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      const [index, item] = next;
      // oxlint-disable-next-line eslint/no-await-in-loop -- Each worker runs one item at a time.
      await work(item, index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
}
