import { sleep } from "bun";
import { logger } from "./logger";

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
  errorMessage?: string;
}

/**
 * Waits for an arbitrary condition to be true. It keeps polling the condition until it is true or
 * a timeout is reached.
 */
export const waitFor = async (options: WaitForOptions) => {
  const { lambda, iterations = 100, delay = 100, errorMessage } = options;

  for (let i = 0; i < iterations; i++) {
    try {
      const result = await lambda();
      if (result) {
        return;
      }
    } catch (e: unknown) {
      logger.debug(`Try ${i + 1} of ${iterations} failed: ${e}`);
    }

    // Only sleep if there are more iterations remaining
    if (i < iterations - 1) {
      await sleep(delay);
    }
  }

  throw new Error(
    `Failed after ${(iterations * delay) / 1000}s: ${errorMessage || "No error message provided"}`
  );
};
