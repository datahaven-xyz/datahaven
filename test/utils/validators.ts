/**
 * DataHaven launcher utility constants for validator nodes
 *
 * Note: E2E test helper functions (addValidatorToAllowlist, registerOperator,
 * launchDatahavenValidator, etc.) have been moved to test/e2e/framework/test-validators.ts
 */

export const COMMON_LAUNCH_ARGS = [
  "--unsafe-force-node-key-generation",
  "--tmp",
  "--validator",
  "--discover-local",
  "--no-prometheus",
  "--unsafe-rpc-external",
  "--rpc-cors=all",
  "--force-authoring",
  "--no-telemetry",
  "--enable-offchain-indexing=true"
];
