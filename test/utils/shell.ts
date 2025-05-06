import { existsSync } from "node:fs";
import { spawn } from "bun";
import { logger } from "./logger";

export const runShellCommandWithLogger = async (
  command: string,
  options?: { cwd?: string; env?: object }
) => {
  const { cwd = ".", env = {} } = options || {};

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

    const readStream = async (
      reader: typeof stdoutReader | typeof stderrReader,
      streamName: string
    ) => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = new TextDecoder().decode(value);
          const trimmedText = text.trim();
          logger.info(trimmedText.includes("\n") ? `\n${trimmedText}` : trimmedText);
        }
      } catch (err) {
        logger.error(`Error reading from ${streamName} stream:`, err);
      } finally {
        reader.releaseLock();
      }
    };

    Promise.all([readStream(stdoutReader, "stdout"), readStream(stderrReader, "stderr")]);

    await proc.exited;
  } catch (err) {
    logger.error("❌ Error running shell command:", command, "in", cwd);
    logger.error(err);
    throw err;
  }
};
