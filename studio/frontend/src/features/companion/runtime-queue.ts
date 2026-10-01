// The Eris renderer owns one scene. Finish a pending load before teardown or
// another stage changes its global settings, including React StrictMode remounts.
export function createRuntimeQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(operation: () => Promise<T> | T): Promise<T> {
    const result = tail.then(operation);
    tail = result.catch(() => undefined);
    return result;
  };
}
