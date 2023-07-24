/**
 * @param time - in seconds
 * @returns a promise that resolves in the specified time
 */
export function sleep(time: number) {
  return new Promise(
    resolve => setTimeout(resolve, time * 1000)
  );
}