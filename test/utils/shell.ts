import { existsSync } from "node:fs";
import { spawn } from "bun";
import { logger } from "./logger";

export type LogLevel = "info" | "debug" | "error" | "warn";

export const runShellCommandWithLogger = async (
  command: string,
  options?: {
    cwd?: string;
    env?: object;
    logLevel?: LogLevel;
    waitFor?: (...args: unknown[]) => Promise<void>;
    throwOnError?: boolean;
  }
) => {
  const { cwd = ".", env = {}, logLevel = "info" as LogLevel, throwOnError = true } = options || {};

  try {
    if (!existsSync(cwd)) {
      logger.error("❌ CWD does not exist:", cwd);
      throw new Error("❌ CWD does not exist");
    }

    const proc = spawn(["sh", "-c", command], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        ...env
      }
    });

    const stdoutReader = proc.stdout.getReader();
    const stderrReader = proc.stderr.getReader();

    let stderrBuffer = "";

    const readStream = async (
      reader: typeof stdoutReader,
      streamName: string,
      logLevel: LogLevel
    ) => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = new TextDecoder().decode(value);
          const trimmedText = text.trim();
          if (trimmedText) {
            logger[logLevel](
              trimmedText.includes("\n") ? `>_ \n${trimmedText}` : `>_ ${trimmedText}`
            );
          }
        }
      } catch (err) {
        logger.error(`Error reading from ${streamName} stream:`, err);
      } finally {
        reader.releaseLock();
      }
    };

    const readStderr = async () => {
      try {
        while (true) {
          const { done, value } = await stderrReader.read();
          if (done) break;
          stderrBuffer += new TextDecoder().decode(value);
        }
      } catch (err) {
        logger.error("Error reading from stderr stream:", err);
      } finally {
        stderrReader.releaseLock();
      }
    };

    await Promise.all([readStream(stdoutReader, "stdout", logLevel), readStderr()]);

    if (options?.waitFor) {
      await options.waitFor();
    }

    const exitCode = await proc.exited;

    // Only log stderr if the command failed
    if (exitCode !== 0) {
      logger.error("❌ Command failed with exit code:", exitCode);
      const trimmedStderr = stderrBuffer.trim();
      if (trimmedStderr) {
        logger.error("Stderr:");
        logger.error(
          trimmedStderr.includes("\n") ? `>_ \n${trimmedStderr}` : `>_ ${trimmedStderr}`
        );
      }

      if (throwOnError) {
        throw new Error(`Command failed with exit code ${exitCode}`);
      }
    }
  } catch (err) {
    logger.error("❌ Error running shell command:", command, "in", cwd);
    logger.error(err);
    throw err;
  }
};
