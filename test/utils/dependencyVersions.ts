import { $ } from "bun";
import path from "node:path";
import { logger } from "./logger";

export interface DependencyInfo {
  release?: string;
  gitCommit: string;
}

export interface DependencyVersions {
  eigenlayer: DependencyInfo;
  snowbridge: DependencyInfo;
}

const resolveRepoRoot = (): string => {
  const cwd = process.cwd();
  const base = path.basename(cwd);
  return base === "test" ? path.join(cwd, "..") : cwd;
};

const getGitInfo = async (relativePath: string): Promise<DependencyInfo> => {
  const repoRoot = resolveRepoRoot();
  const fullPath = path.join(repoRoot, relativePath);

  const { stdout: shaOut, exitCode: shaCode } =
    await $`git -C ${fullPath} rev-parse HEAD`.nothrow().quiet();

  if (shaCode !== 0) {
    throw new Error(`Failed to resolve git commit for ${relativePath}`);
  }

  const gitCommit = shaOut.toString().trim();

  const { stdout: tagOut, exitCode: tagCode } =
    await $`git -C ${fullPath} describe --tags --exact-match`.nothrow().quiet();

  const release = tagCode === 0 ? tagOut.toString().trim() : undefined;

  return { gitCommit, release };
};

export const getDependencyVersions = async (): Promise<DependencyVersions> => {
  try {
    const [eigenlayer, snowbridge] = await Promise.all([
      getGitInfo(path.join("contracts", "lib", "eigenlayer-contracts")),
      getGitInfo(path.join("contracts", "lib", "snowbridge"))
    ]);

    logger.info(
      `Derived dependency versions: eigenlayer=${eigenlayer.release ?? eigenlayer.gitCommit}, snowbridge=${snowbridge.release ?? snowbridge.gitCommit}`
    );

    return { eigenlayer, snowbridge };
  } catch (error) {
    logger.error(`Failed to derive dependency versions from git: ${error}`);
    throw error;
  }
};


