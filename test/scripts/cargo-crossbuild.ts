import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { $ } from "bun";
import { logger } from "utils";

const LOG_LEVEL = Bun.env.LOG_LEVEL || "info";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const cargoCrossbuild = async (options: {
  datahavenBuildExtraArgs?: string;
}) => {
  logger.info("🔀 Cross-building DataHaven node for Linux AMD64");

  const ARCH = (await $`uname -m`.text()).trim();
  const OS = (await $`uname -s`.text()).trim();

  // Case: Apple Silicon
  if (ARCH === "arm64" && OS === "Darwin") {
    logger.info("🍎 Apple Silicon detected. Proceeding with cross-building...");

    if (!isCommandAvailable("zig")) {
      logger.error("Zig is not installed. Please install Zig to proceed.");
      logger.info(
        "Instructions to install can be found here: https://ziglang.org/learn/getting-started/"
      );
      throw new Error("Zig is not installed");
    }

    installCargoZigbuild();

    const target = "x86_64-unknown-linux-gnu";
    await addRustupTarget(target);

    // Build and copy libpq.so before cargo zigbuild
    await buildAndCopyLibpq(target);

    // Get additional arguments from command line
    const additionalArgs = options.datahavenBuildExtraArgs ?? "";

    const command = `cargo zigbuild --target ${target} --release ${additionalArgs}}`;
    logger.debug(`Running build command: ${command}`);

    if (LOG_LEVEL === "debug") {
      await $`sh -c "${command}"`.cwd(`${process.cwd()}/../operator`);
    } else {
      await $`sh -c "${command}"`.cwd(`${process.cwd()}/../operator`).quiet();
    }

    // Case: Linux x86
  } else if (ARCH === "x86_64" && OS === "Linux") {
    logger.info("🖥️ Linux AMD64 detected. Proceeding with cross-building...");

    const target = "x86_64-unknown-linux-gnu";
    await addRustupTarget(target);
    const command = `cargo build --target ${target} --release`;
    logger.debug(`Running build command: ${command}`);

    if (LOG_LEVEL === "debug") {
      await $`sh -c "${command}"`.cwd(`${process.cwd()}/../operator`);
    } else {
      await $`sh -c "${command}"`.cwd(`${process.cwd()}/../operator`).quiet();
    }

    // Case: Unsupported architecture or OS
  } else {
    logger.error("🚨 Unsupported architecture or OS. Please use Apple Silicon or Linux AMD64.");
    logger.info(`Architecture: ${ARCH}; OS: ${OS}`);
    throw new Error("Unsupported architecture or OS");
  }
};

const isCommandAvailable = async (command: string): Promise<boolean> => {
  try {
    await $`command -v ${command}`.text();
    return true;
  } catch {
    return false;
  }
};

const installCargoZigbuild = async (): Promise<void> => {
  if (!(await $`cargo install --list`.text()).includes("cargo-zigbuild")) {
    await $`cargo install cargo-zigbuild --locked`.text();
  }
};

const addRustupTarget = async (target: string): Promise<void> => {
  if (!(await $`rustup target list --installed`.text()).includes(target)) {
    await $`rustup target add ${target}`.text();
  }
};

// Updated function to build and copy libpq.so
const buildAndCopyLibpq = async (target: string): Promise<void> => {
  logger.info("🏗️ Building and copying libpq.so...");

  // Set Docker platform
  process.env.DOCKER_DEFAULT_PLATFORM = "linux/amd64";

  // Build Docker image
  const dockerfilePath = path.join(__dirname, "../docker/crossbuild-mac-libpq.dockerfile");
  logger.debug(
    await $`docker build -f ${dockerfilePath} -t crossbuild-libpq ${path.join(__dirname, "..", "..")}`.text()
  );

  // Create container and copy libpq.so
  logger.debug(await $`docker create --name linux-libpq-container crossbuild-libpq`.text());

  const destPath = path.join(
    __dirname,
    "..",
    "..",
    "operator",
    "target",
    target,
    "release",
    "deps"
  );

  // Ensure the destination directory exists
  fs.mkdirSync(destPath, { recursive: true });

  logger.debug(
    await $`docker cp linux-libpq-container:/artifacts/libpq.so ${path.join(destPath, "libpq.so")}`.text()
  );

  // Remove container
  logger.debug(await $`docker rm linux-libpq-container`.text());

  // Set RUSTFLAGS with the correct library path
  process.env.RUSTFLAGS = `-C link-arg=-Wl,-rpath,$ORIGIN/../release/deps -L ${destPath}`;
  logger.trace(`RUSTFLAGS set to: ${process.env.RUSTFLAGS}`);

  logger.success(`libpq.so has been copied to ${destPath}`);
};
