// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {Vm} from "forge-std/Vm.sol";

abstract contract TrackedState is Script {
    bool public recordStateDiff = true;
    string public stateDiffFilename = "./deployments/state-diff.json";

    modifier withStateDiff() {
        if (recordStateDiff) {
            vm.startStateDiffRecording();
        }
        _;
        if (recordStateDiff) {
            Vm.AccountAccess[] memory records = vm.stopAndReturnStateDiff();
            console.log("\n=== STATE DIFF RECORDING ===");
            console.log("Total state changes recorded:", records.length);

            exportStateDiff(vm, records, stateDiffFilename);
            console.log("State diff exported to:", stateDiffFilename);
        }
    }

    function setStateDiffFilename(string memory filename) public {
        stateDiffFilename = filename;
    }

    function disableStateDiff() public {
        recordStateDiff = false;
    }

    struct DeploymentInfo {
        address addr;
        bytes code;
    }

    function collectDeployments(Vm.AccountAccess[] memory records) internal pure returns (DeploymentInfo[] memory, uint256) {
        uint256 deploymentCount;
        for (uint256 i = 0; i < records.length; i++) {
            if (uint256(records[i].kind) == 4) deploymentCount++;
        }

        if (deploymentCount == 0) {
            return (new DeploymentInfo[](0), 0);
        }

        DeploymentInfo[] memory deployments = new DeploymentInfo[](deploymentCount);
        uint256 n;

        for (uint256 i = 0; i < records.length; i++) {
            if (uint256(records[i].kind) != 4) continue;
            address a = records[i].account;
            bool seen;
            for (uint256 j = 0; j < n; j++) {
                if (deployments[j].addr == a) {
                    seen = true;
                    break;
                }
            }
            if (!seen) {
                deployments[n].addr = a;
                deployments[n].code = records[i].deployedCode;
                n++;
            }
        }

        return (deployments, n);
    }

    function processStorageForContract(
        Vm vm,
        address contractAddr,
        Vm.AccountAccess[] memory records,
        string memory storageKey
    ) internal returns (string memory) {
        uint256 maxSlots = 200;
        bytes32[] memory processedSlots = new bytes32[](maxSlots);
        uint256 slotCount;
        string memory storageJson = "";

        if (records.length == 0) return storageJson;

        for (uint256 j = records.length - 1;; j--) {
            if (records[j].account != contractAddr) {
                if (j == 0) break;
                continue;
            }

            uint256 storageLen = records[j].storageAccesses.length;
            for (uint256 s = 0; s < storageLen; s++) {
                if (slotCount >= maxSlots) break;

                Vm.StorageAccess memory access = records[j].storageAccesses[s];
                if (!access.isWrite || access.reverted) continue;

                bool isDuplicate;
                for (uint256 d = 0; d < slotCount; d++) {
                    if (processedSlots[d] == access.slot) {
                        isDuplicate = true;
                        break;
                    }
                }
                if (isDuplicate) continue;

                storageJson = vm.serializeBytes32(storageKey, vm.toString(access.slot), access.newValue);
                processedSlots[slotCount++] = access.slot;
            }

            if (j == 0) break;
        }

        return storageJson;
    }

    function buildSimplifiedJson(Vm vm, Vm.AccountAccess[] memory records) internal returns (string memory) {
        if (records.length == 0) {
            return vm.serializeString("contracts", "empty", "[]");
        }

        (DeploymentInfo[] memory deployments, uint256 deploymentCount) = collectDeployments(records);

        if (deploymentCount == 0) {
            return vm.serializeString("contracts", "empty", "[]");
        }

        string memory jsonKey = "contracts";
        string memory finalJson = "";

        for (uint256 i = 0; i < deploymentCount; i++) {
            string memory contractKey = string.concat("contract_", vm.toString(i));

            vm.serializeAddress(contractKey, "address", deployments[i].addr);
            vm.serializeBytes(contractKey, "code", deployments[i].code);

            string memory storageKey = string.concat(contractKey, "_storage");
            string memory storageJson = processStorageForContract(vm, deployments[i].addr, records, storageKey);

            string memory contractJson = vm.serializeString(contractKey, "storage", storageJson);

            if (i == deploymentCount - 1) {
                finalJson = vm.serializeString(jsonKey, vm.toString(i), contractJson);
            } else {
                vm.serializeString(jsonKey, vm.toString(i), contractJson);
            }
        }

        return finalJson;
    }

    function exportStateDiff(Vm vm, Vm.AccountAccess[] memory records, string memory filename) internal {
        string memory json = buildSimplifiedJson(vm, records);
        vm.writeJson(json, filename);
    }
}
