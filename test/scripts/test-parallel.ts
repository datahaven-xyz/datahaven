#!/usr/bin/env bun
import { existsSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { $ } from "bun";
import { logger, printHeader } from "../utils";

/**
 * Script to run all test suites in parallel with concurrency control
 */

const TEST_TIMEOUT = 900000; // 15 minutes
const LOG_DIR = "tmp/e2e-test-logs";
const MAX_CONCURRENT_TESTS = 3; // Limit concurrent tests to prevent resource exhaustion

// Track all spawned processes for cleanup
const spawnedProcesses: Set<ReturnType<typeof Bun.spawn>> = new Set();

async function ensureLogDirectory() {
  const logPath = join(process.cwd(), LOG_DIR);
  if (!existsSync(logPath)) {
    mkdirSync(logPath, { recursive: true });
  }

  // Clear content of existing .log files
  try {
    const existingLogs = await $`find ${logPath} -name "*.log" -type f`.text().catch(() => "");
    const logFiles = existingLogs
      .trim()
      .split("\n")
      .filter((file) => file.length > 0);

    if (logFiles.length > 0) {
      logger.info(`🧹 Clearing content of ${logFiles.length} existing log files...`);
      // Truncate files to 0 bytes using Bun.write
      for (const logFile of logFiles) {
        await Bun.write(logFile, "");
      }
    }
  } catch (error) {
    logger.warn("Failed to clear existing log files:", error);
  }
  return logPath;
}

async function killAllProcesses() {
  logger.info("🛑 Killing all spawned processes...");

  // Kill all tracked processes and their children
  const killPromises = Array.from(spawnedProcesses).map(async (proc) => {
    try {
      const pid = proc.pid;
      logger.info(`Killing process tree for PID ${pid}...`);

      // First, try to get all child processes
      try {
        // Get all descendant PIDs using pgrep
        const childPids = await $`pgrep -P ${pid}`.text().catch(() => "");
        const allPids = [
          pid,
          ...childPids
            .trim()
            .split("\n")
            .filter((p) => p)
        ]
          .map((p) => Number.parseInt(p.toString()))
          .filter((p) => !Number.isNaN(p));

        logger.info(`Found PIDs to kill: ${allPids.join(", ")}`);

        // Kill all processes in reverse order (children first)
        for (const targetPid of allPids.reverse()) {
          try {
            await $`kill -TERM ${targetPid}`.quiet();
          } catch {
            // Process might already be dead
          }
        }

        // Give processes a moment to clean up
        await Bun.sleep(500);

        // Force kill any remaining processes
        for (const targetPid of allPids) {
          try {
            await $`kill -KILL ${targetPid}`.quiet();
          } catch {
            // Process already dead
          }
        }
      } catch {
        // Fallback: try process group kill
        try {
          await $`kill -TERM -${pid}`.quiet();
          await Bun.sleep(500);
          await $`kill -KILL -${pid}`.quiet();
        } catch {
          // Process group might not exist
        }
      }

      // Also try to kill the process directly
      try {
        proc.kill("SIGKILL");
      } catch {
        // Process already dead
      }
    } catch (error) {
      logger.error("Error killing process:", error);
    }
  });

  await Promise.all(killPromises);
  spawnedProcesses.clear();

  // Also kill any lingering kurtosis or docker processes started by tests
  try {
    logger.info("Cleaning up any lingering test processes...");

    // Kill kurtosis processes
    await $`pkill -f "kurtosis.*e2e-test" || true`.quiet();

    // Find and kill all containers with e2e-test prefix
    const containers = await $`docker ps -q --filter "name=e2e-test"`.text().catch(() => "");
    if (containers.trim()) {
      logger.info("Killing e2e-test containers...");
      await $`docker kill ${containers.trim().split("\n").join(" ")}`.quiet().catch(() => {});
    }

    // Also clean up any snowbridge containers
    const snowbridgeContainers = await $`docker ps -q --filter "name=snowbridge"`
      .text()
      .catch(() => "");
    if (snowbridgeContainers.trim()) {
      logger.info("Killing snowbridge containers...");
      await $`docker kill ${snowbridgeContainers.trim().split("\n").join(" ")}`
        .quiet()
        .catch(() => {});
    }

    // Kill any remaining bun test processes
    await $`pkill -f "bun.*test.*\\.test\\.ts" || true`.quiet();
  } catch {
    // Ignore errors - processes might not exist
  }
}

// Set up signal handlers for graceful shutdown
process.on("SIGINT", async () => {
  logger.info("\n⚠️  Received SIGINT, cleaning up...");
  await killAllProcesses();
  process.exit(130); // Standard exit code for SIGINT
});

process.on("SIGTERM", async () => {
  logger.info("\n⚠️  Received SIGTERM, cleaning up...");
  await killAllProcesses();
  process.exit(143); // Standard exit code for SIGTERM
});

// Handle uncaught exceptions
process.on("uncaughtException", async (error) => {
  logger.error("💥 Uncaught exception:", error);
  await killAllProcesses();
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", async (reason, _promise) => {
  logger.error("💥 Unhandled promise rejection:", reason);
  await killAllProcesses();
  process.exit(1);
});

async function getTestFiles(): Promise<string[]> {
  const result = await $`find suites -name "*.test.ts" -type f`.text();
  return result
    .trim()
    .split("\n")
    .filter((file) => file.length > 0);
}

async function runTest(
  file: string,
  logPath: string
): Promise<{
  file: string;
  success: boolean;
  duration: string;
  logFile: string;
  exitCode?: number;
  error?: any;
}> {
  const startTime = Date.now();
  const testName = basename(file, ".test.ts");
  const logFile = join(logPath, `${testName}.log`);

  logger.info(`📋 Starting ${file}...`);

  try {
    // Run each test file in its own process group, capturing all output to log file
    const proc = Bun.spawn(["bun", "test", file, "--timeout", TEST_TIMEOUT.toString()], {
      stdout: "pipe",
      stderr: "pipe",
      // Create a new process group so we can kill all child processes
      env: {
        ...process.env,
        // This will help identify processes started by this test run
        E2E_TEST_RUN_ID: `e2e-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
      }
    });

    // Track the spawned process
    spawnedProcesses.add(proc);

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

    // Remove from tracked processes
    spawnedProcesses.delete(proc);

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
}

async function runTestsWithConcurrencyLimit() {
  logger.info(`🚀 Starting test suites with max concurrency of ${MAX_CONCURRENT_TESTS}...`);

  // Ensure log directory exists
  const logPath = await ensureLogDirectory();
  logger.info(`📁 Logs will be saved to: ${LOG_DIR}/`);

  // Get all test files dynamically
  const testFiles = await getTestFiles();
  logger.info(`📋 Found ${testFiles.length} test files:`);
  testFiles.forEach((file) => logger.info(`  - ${file}`));

  // Create a queue of test files
  const testQueue = [...testFiles];
  const results: Array<Awaited<ReturnType<typeof runTest>>> = [];
  const runningTests = new Map<string, Promise<any>>();

  // Process tests with concurrency limit
  while (testQueue.length > 0 || runningTests.size > 0) {
    // Start new tests if we have capacity
    while (runningTests.size < MAX_CONCURRENT_TESTS && testQueue.length > 0) {
      const testFile = testQueue.shift();
      if (!testFile) continue;
      const testPromise = runTest(testFile, logPath);

      runningTests.set(testFile, testPromise);

      // Add 1 second delay between starting test suites to prevent resource contention
      if (testQueue.length > 0) {
        await Bun.sleep(1000);
      }

      // When test completes, remove it from running tests and store result
      testPromise
        .then((result) => {
          runningTests.delete(testFile);
          results.push(result);
        })
        .catch((error) => {
          runningTests.delete(testFile);
          results.push({
            file: testFile,
            success: false,
            duration: "0",
            logFile: join(logPath, `${basename(testFile, ".test.ts")}.log`),
            error
          });
        });
    }

    // Wait for at least one test to complete before checking again
    if (runningTests.size > 0) {
      await Promise.race(runningTests.values());
    }
  }

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
    await killAllProcesses();
    process.exit(1);
  } else {
    logger.success("All tests passed!");
    await killAllProcesses();
  }
}

// Run the tests
runTestsWithConcurrencyLimit().catch(async (error) => {
  logger.error("Failed to run tests:", error);
  await killAllProcesses();
  process.exit(1);
});
