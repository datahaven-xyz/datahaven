#!/usr/bin/env bun

import fs from "node:fs";
import path from "node:path";
import { $ } from "bun";
import { logger } from "../utils/index";

interface DebugOptions {
  rpcUrl: string;
}

export const debugValidatorSet = async (options: DebugOptions) => {
  const { rpcUrl } = options;

  logger.info("🔍 Debugging validator set state...");

  // Get cast path
  const { stdout: castPath } = await $`which cast`.quiet();
  const castExecutable = castPath.toString().trim();

  // Get deployed contract addresses
  const deploymentPath = path.resolve("contracts/deployments/anvil.json");
  if (!fs.existsSync(deploymentPath)) {
    logger.error(`Deployment file not found: ${deploymentPath}`);
    return;
  }

  const deployments = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const serviceManagerAddress = deployments.ServiceManager;
  const allocationManagerAddress = deployments.AllocationManager;

  logger.info(`ServiceManager: ${serviceManagerAddress}`);
  logger.info(`AllocationManager: ${allocationManagerAddress}`);

  // Check if contract has code
  const { stdout: codeCheck } = await $`${castExecutable} code ${serviceManagerAddress} --rpc-url ${rpcUrl}`.quiet();
  if (codeCheck.toString().trim() === "0x") {
    logger.error("❌ ServiceManager contract has no code deployed!");
    return;
  }

  // Get validators from AllocationManager
  logger.info("\n📋 Checking validator set members...");
  
  // Call getMembers(OperatorSet) where OperatorSet = {avs: ServiceManager, id: 0}
  const getMembersCalldata = `${castExecutable} call ${allocationManagerAddress} "getMembers((address,uint32))" "(${serviceManagerAddress},0)" --rpc-url ${rpcUrl}`;
  
  const { stdout: membersOutput, exitCode } = await $`sh -c ${getMembersCalldata}`.nothrow().quiet();
  
  if (exitCode !== 0) {
    logger.error("Failed to get validator set members");
  } else {
    logger.info(`Validator set members: ${membersOutput.toString().trim()}`);
  }

  // Check a few validator addresses for their Solochain mapping
  const validatorAddresses = [
    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // First anvil account
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Second anvil account
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"  // Third anvil account
  ];

  logger.info("\n🔗 Checking Solochain address mappings...");
  for (const validator of validatorAddresses) {
    const { stdout: solochainAddress } = await $`${castExecutable} call ${serviceManagerAddress} "validatorEthAddressToSolochainAddress(address)" ${validator} --rpc-url ${rpcUrl}`.quiet();
    const addressHex = solochainAddress.toString().trim();
    logger.info(`${validator}: ${addressHex === "0x0000000000000000000000000000000000000000000000000000000000000000" ? "Not set" : addressHex}`);
  }

  // Try to simulate the buildNewValidatorSetMessage call
  logger.info("\n🔧 Testing buildNewValidatorSetMessage...");
  const { stdout: messageOutput, exitCode: messageExitCode } = await $`${castExecutable} call ${serviceManagerAddress} "buildNewValidatorSetMessage()" --rpc-url ${rpcUrl}`.nothrow().quiet();
  
  if (messageExitCode !== 0) {
    logger.error("❌ buildNewValidatorSetMessage() call failed");
  } else {
    logger.info(`✅ buildNewValidatorSetMessage() returned: ${messageOutput.toString().trim().substring(0, 100)}...`);
  }

  // Check contract owner
  logger.info("\n👤 Checking contract owner...");
  const { stdout: ownerOutput } = await $`${castExecutable} call ${serviceManagerAddress} "owner()" --rpc-url ${rpcUrl}`.quiet();
  logger.info(`Contract owner: ${ownerOutput.toString().trim()}`);
};

// Allow script to be run directly
if (import.meta.main) {
  const args = process.argv.slice(2);
  const rpcUrlIndex = args.indexOf("--rpc-url");
  const rpcUrl = rpcUrlIndex !== -1 && rpcUrlIndex + 1 < args.length ? args[rpcUrlIndex + 1] : undefined;

  if (!rpcUrl) {
    console.error("Error: --rpc-url parameter is required");
    process.exit(1);
  }

  debugValidatorSet({ rpcUrl }).catch((error) => {
    console.error("Debug failed:", error);
    process.exit(1);
  });
}