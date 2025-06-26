#!/usr/bin/env bun
import { existsSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
/**
 * Script to run all test suites in parallel
 */
import { $ } from "bun";
import { logger, printHeader } from "../utils";

const TEST_TIMEOUT = 900000; // 15 minutes
const LOG_DIR = "tmp/e2e-test-logs";

async function ensureLogDirectory() {
  const logPath = join(process.cwd(), LOG_DIR);
  if (!existsSync(logPath)) {
    mkdirSync(logPath, { recursive: true });
  }
  return logPath;
}

async function getTestFiles(): Promise<string[]> {
  const result = await $`find suites -name "*.test.ts" -type f`.text();
  return result
    .trim()
    .split("\n")
    .filter((file) => file.length > 0);
}

async function runTestsInParallel() {
  logger.info("🚀 Starting all test suites in parallel...");

  // Ensure log directory exists
  const logPath = await ensureLogDirectory();
  logger.info(`📁 Logs will be saved to: ${LOG_DIR}/`);

  // Get all test files dynamically
  const testFiles = await getTestFiles();
  logger.info(`📋 Found ${testFiles.length} test files:`);
  testFiles.forEach((file) => logger.info(`  - ${file}`));

  // Launch all test files in parallel
  const testPromises = testFiles.map(async (file) => {
    const startTime = Date.now();
    const testName = basename(file, ".test.ts");
    const logFile = join(logPath, `${testName}.log`);

    logger.info(`📋 Starting ${file}...`);

    try {
      // Run each test file in its own process, capturing all output to log file
      const proc = Bun.spawn(["bun", "test", file, "--timeout", TEST_TIMEOUT.toString()], {
        stdout: "pipe",
        stderr: "pipe"
      });

      // Create write stream for log file
      const logFileHandle = Bun.file(logFile);
      const writer = logFileHandle.writer();

      // Write both stdout and stderr to the same log file
      const decoder = new TextDecoder();

      // Handle stdout
      const stdoutReader = proc.stdout.getReader();
      const stdoutPromise = (async () => {
        while (true) {
          const { done, value } = await stdoutReader.read();
          if (done) break;
          const text = decoder.decode(value);
          await writer.write(text);
        }
      })();

      // Handle stderr
      const stderrReader = proc.stderr.getReader();
      const stderrPromise = (async () => {
        while (true) {
          const { done, value } = await stderrReader.read();
          if (done) break;
          const text = decoder.decode(value);
          await writer.write(text);
        }
      })();

      // Wait for process to complete
      await Promise.all([stdoutPromise, stderrPromise]);
      const exitCode = await proc.exited;
      await writer.end();

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      if (exitCode === 0) {
        logger.success(`${file} passed (${duration}s) - Log: ${logFile}`);
        return { file, success: true, duration, logFile };
      }
      logger.error(`❌ ${file} failed (${duration}s) - Log: ${logFile}`);
      return { file, success: false, duration, logFile, exitCode };
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.error(`❌ ${file} crashed (${duration}s) - Log: ${logFile}:`, error);

      // Write error to log file
      const errorLog = Bun.file(logFile);
      await Bun.write(errorLog, `Test crashed with error:\n${error}\n`);

      return { file, success: false, duration, error, logFile };
    }
  });

  // Wait for all tests to complete
  const results = await Promise.all(testPromises);

  // Summary
  printHeader("📊 Test Summary");
  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  results.forEach((result) => {
    const icon = result.success ? "✅" : "❌";
    logger.info(`${icon} ${result.file} (${result.duration}s)`);
    logger.info(`   📄 Log: ${result.logFile}`);
  });

  logger.info(`Total: ${passed} passed, ${failed} failed`);
  logger.info(`📁 All logs saved to: ${LOG_DIR}/`);

  // Exit with error if any tests failed
  if (failed > 0) {
    logger.error("❌ Some tests failed! Check the logs for details.");
    process.exit(1);
  } else {
    logger.success("All tests passed!");
  }
}

// Run the tests
runTestsInParallel().catch((error) => {
  logger.error("Failed to run tests:", error);
  process.exit(1);
});
