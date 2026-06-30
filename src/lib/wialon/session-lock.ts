/** Wialon tokens allow only one active session — serialize all API usage. */
let tail: Promise<void> = Promise.resolve();

export function withWialonSessionLock<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(task, task);
  tail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}
