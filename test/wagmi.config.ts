import { defineConfig } from "@wagmi/cli";
import { actions, foundry } from "@wagmi/cli/plugins";

export default defineConfig({
  out: "contract-bindings/generated.ts",
  plugins: [
    actions(), //<--- can't seem to get this to work
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
        "EigenPodManager.sol/**",
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
