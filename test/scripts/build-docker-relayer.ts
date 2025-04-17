import path from "node:path";
import { $ } from "bun";
import invariant from "tiny-invariant";
import { logger, printDivider, printHeader } from "utils";

const IMAGE_NAME = "snowbridge-relay:local";
const RELATIVE_DOCKER_FILE_PATH = "../../docker/SnowbridgeRelayer.dockerfile";
const CONTEXT = "../..";

// This can be run with `bun build:docker:relayer` or via a script by importing the below function
export default async function buildRelayer() {
  printHeader(`Running docker-build at: ${__dirname}`);
  const dockerfilePath = path.resolve(__dirname, RELATIVE_DOCKER_FILE_PATH);
  const contextPath = path.resolve(__dirname, CONTEXT);

  const file = Bun.file(dockerfilePath);
  invariant(await file.exists(), `Dockerfile not found at ${dockerfilePath}`);
  logger.debug(`Dockerfile found at ${dockerfilePath}`);

  const dockerCommand = `docker build -t ${IMAGE_NAME} -f ${dockerfilePath} ${contextPath}`;
  logger.debug(`Executing docker command: ${dockerCommand}`);
  const { stdout, stderr, exitCode } = await $`sh -c ${dockerCommand}`.nothrow().quiet();

  if (exitCode !== 0) {
    logger.error(`Docker build failed with exit code ${exitCode}`);
    logger.error(`stdout: ${stdout.toString()}`);
    logger.error(`stderr: ${stderr.toString()}`);
    process.exit(exitCode);
  }

  logger.info("Docker build action completed");

  const {
    exitCode: runExitCode,
    stdout: runStdout,
    stderr: runStderr
  } = await $`sh -c docker run ${IMAGE_NAME}`.quiet().nothrow();

  if (runExitCode !== 0) {
    logger.error(`Docker run failed with exit code ${runExitCode}`);
    logger.error(`stdout: ${runStdout.toString()}`);
    logger.error(`stderr: ${runStderr.toString()}`);
    process.exit(runExitCode);
  }

  logger.info("Docker run action completed");
  logger.success("Docker image built successfully");
}
