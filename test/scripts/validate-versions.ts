import { logger } from "utils";
import { parseDeploymentsFile } from "utils/contracts";

/**
 * Validates that a version string follows semantic versioning (X.Y.Z)
 */
export const isValidSemver = (version: string): boolean => {
	const semverRegex = /^\d+\.\d+\.\d+$/;
	return semverRegex.test(version);
};

/**
 * Comprehensive version validation across the DataHaven codebase
 * Checks:
 * 1. Version format (semantic versioning)
 * 2. Version field presence in deployment files
 * 3. Generated file consistency
 */
export const validateVersions = async () => {
	logger.info("🔍 Validating version consistency across DataHaven codebase...");

	const chains = ["anvil", "hoodi", "ethereum"];
	let allOk = true;

	// 1. Format validation (semver)
	logger.info("\n📋 Checking version formats...");
	for (const chain of chains) {
		try {
			const deployments = await parseDeploymentsFile(chain);
			const version = (deployments as any).version;

			if (!version) {
				logger.warn(`⚠️  No version field in ${chain}.json`);
				continue;
			}

			if (!isValidSemver(version)) {
				logger.error(
					`❌ Invalid version format in ${chain}.json: ${version} (expected X.Y.Z)`,
				);
				allOk = false;
			} else {
				logger.info(`✅ ${chain}.json: ${version} (valid semver)`);
			}
		} catch (error) {
			const errorMsg = String(error);
			if (errorMsg.includes("deployments file") || errorMsg.includes("does not exist")) {
				logger.debug(`ℹ️  Skipping ${chain}.json (file does not exist)`);
				continue;
			}
			logger.error(`❌ Could not read ${chain}.json: ${error}`);
			allOk = false;
		}
	}

	// 2. Dependency validation (existing versioning checks)
	logger.info("\n🔗 Checking dependency versions...");
	const { checkDependencyVersions } = await import("utils/contracts/versioning");
	for (const chain of chains) {
		try {
			const depsOk = await checkDependencyVersions(chain);
			if (!depsOk) {
				logger.warn(`⚠️  Dependency version mismatch for ${chain}`);
				allOk = false;
			}
		} catch (error) {
			const errorMsg = String(error);
			if (errorMsg.includes("deployments file") || errorMsg.includes("does not exist")) {
				logger.debug(`ℹ️  Skipping ${chain} (deployment file does not exist)`);
				continue;
			}
			logger.debug(`ℹ️  Skipping ${chain} dependency check: ${error}`);
			// Not a hard error - infrastructure may be unavailable
		}
	}

	// 3. Generated file consistency check
	logger.info("\n📄 Checking generated Version.sol...");
	const generatedPath = "../contracts/src/generated/Version.sol";
	const exists = await Bun.file(generatedPath).exists();

	if (!exists) {
		logger.error(
			"❌ Generated Version.sol not found. Run 'bun generate:version' to create it.",
		);
		allOk = false;
	} else {
		logger.info("✅ Version.sol exists");

		// Read and validate content matches current deployment files
		const content = await Bun.file(generatedPath).text();
		for (const chain of chains) {
			try {
				const deployments = await parseDeploymentsFile(chain);
				const version = (deployments as any).version || "0.0.0";
				const expectedConstant = `${chain.toUpperCase()}_VERSION = "${version}"`;

				if (!content.includes(expectedConstant)) {
					logger.error(
						`❌ Version.sol out of sync for ${chain}: expected ${version} in generated file`,
					);
					logger.error(
						"   Run 'bun generate:version' and commit the updated file.",
					);
					allOk = false;
				} else {
					logger.info(`✅ ${chain} version in sync (${version})`);
				}
			} catch (error) {
				const errorMsg = String(error);
				if (errorMsg.includes("deployments file") || errorMsg.includes("does not exist")) {
					logger.debug(`ℹ️  Skipping ${chain} sync check (file does not exist)`);
					continue;
				}
				logger.warn(`⚠️  Could not validate ${chain} sync: ${error}`);
			}
		}
	}

	if (!allOk) {
		logger.error("\n❌ Version validation failed");
		throw new Error("Version validation failed");
	}

	logger.success("\n✅ All version checks passed");
};

// Allow direct execution
if (import.meta.main) {
	await validateVersions();
}
