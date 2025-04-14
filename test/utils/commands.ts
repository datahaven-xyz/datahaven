import { logger } from "./logger";

/**
 * Execute a command and log its output at debug level
 */
export const runCommand = async <T>(command: Promise<T>): Promise<T> => {
  try {
    const result = await command;
    if (result && typeof result === "object") {
      // Log stdout if it exists
      if ("stdout" in result && result.stdout) {
        logger.debug(`Command stdout: ${result.stdout.toString().trim()}`);
      }

      // Log stderr if it exists and isn't empty
      if ("stderr" in result && result.stderr && result.stderr.toString().trim() !== "") {
        logger.error(
          `❌ Command [${command.toString()}] failed with error: \n${result.stderr.toString().trim()}`
        );
      }
    }
    return result;
  } catch (error) {
    // Log error and rethrow
    logger.error(`💀 Command [${command.toString()}] threw error: \n${error}`);
    throw error;
  }
};
