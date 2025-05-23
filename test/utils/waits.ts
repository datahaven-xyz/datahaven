import { sleep } from "bun";

/**
 * Options for the `waitFor` function.
 * @param lambda - The condition to wait for.
 * @param iterations - The number of iterations to wait for the condition to be true.
 * @param delay - The delay between iterations.
 */
export interface WaitForOptions {
  lambda: () => Promise<boolean>;
  iterations?: number;
  delay?: number;
}

/**
 * Waits for an arbitrary condition to be true. It keeps polling the condition until it is true or
 * a timeout is reached.
 */
export const waitFor = async (options: WaitForOptions) => {
  const { lambda, iterations = 100, delay = 100 } = options;

  for (let i = 0; i < iterations; i++) {
    try {
      await sleep(delay);
      const result = await lambda();
      if (result) {
        return;
      }
    } catch (e: unknown) {
      if (i === iterations - 1) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        throw new Error(`Failed after ${(iterations * delay) / 1000}s: ${errorMessage}`);
      }
    }
  }
  throw new Error(`Failed after ${(iterations * delay) / 1000}s`);
};
