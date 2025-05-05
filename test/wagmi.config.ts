import { defineConfig } from "@wagmi/cli";
import { actions, foundry } from "@wagmi/cli/plugins";

export default defineConfig({
  out: "contract-bindings/generated.ts",
  plugins: [
    actions(), // TODO: Investigate why the actions() plugin is not functioning as expected. Refer to the @wagmi/cli documentation for potential solutions.
    foundry({
      project: "../contracts",
      include: [
        "BeefyClient.sol/**",
        "AgentExecutor.sol/**",
        "Gateway.sol/**",
        "TransparentUpgradeableProxy.sol/**",
        "VetoableSlasher.sol/**",
        "RewardsRegistry.sol/**",
        "Agent.sol/**",
        "StrategyManager.sol/**",
        "AVSDirectory.sol/**",
        "DataHavenServiceManager.sol/**",
        "EigenPodManager.sol/**",
        "EigenPod.sol/**",
        "UpgradeableBeacon.sol/**",
        "RewardsCoordinator.sol/**",
        "AllocationManager.sol/**",
        "DelegationManager.sol/**",
        "PermissionController.sol/**",
        "IETHPOSDeposit.sol/**",
        "StrategyBaseTVLLimits.sol/**"
      ]
    })
  ]
});
