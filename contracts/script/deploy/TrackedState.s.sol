// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {Vm} from "forge-std/Vm.sol";

abstract contract TrackedState is Script {
    bool public recordStateDiff = true;
    string public stateDiffFilename = "./deployments/state-diff.json";
    
    // EIP-1967 storage slots
    // bytes32(uint256(keccak256("eip1967.proxy.admin")) - 1)
    bytes32 constant ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
    // bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1)
    bytes32 constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    // bytes32(uint256(keccak256("eip1967.proxy.beacon")) - 1)
    bytes32 constant BEACON_SLOT = 0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50;

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

    struct StorageSlot {
        bytes32 slot;
        bytes32 value;
        bool exists;
    }

    function processStorageForContract(
        Vm vm,
        address contractAddr,
        Vm.AccountAccess[] memory records,
        string memory storageKey
    ) internal returns (string memory) {
        uint256 maxSlots = 200;
        StorageSlot[] memory finalStorage = new StorageSlot[](maxSlots);
        uint256 uniqueSlotCount;
        string memory storageJson = "";

        if (records.length == 0) return storageJson;

        console.log("Processing storage for contract:", vm.toString(contractAddr));

        // Process all records in chronological order to get the final state
        for (uint256 j = 0; j < records.length; j++) {
            if (records[j].account != contractAddr) {
                continue;
            }

            uint256 storageLen = records[j].storageAccesses.length;
            console.log("Found", storageLen, "storage accesses for contract", vm.toString(contractAddr));
            
            for (uint256 s = 0; s < storageLen; s++) {
                Vm.StorageAccess memory access = records[j].storageAccesses[s];
                if (!access.isWrite || access.reverted) continue;

                console.log("Storage write - slot:", vm.toString(uint256(access.slot)), "value:", vm.toString(uint256(access.newValue)));

                // Find if this slot already exists in our tracking
                bool found = false;
                for (uint256 d = 0; d < uniqueSlotCount; d++) {
                    if (finalStorage[d].slot == access.slot) {
                        // Update the value with the latest write
                        finalStorage[d].value = access.newValue;
                        found = true;
                        break;
                    }
                }

                // If not found and we have space, add it
                if (!found && uniqueSlotCount < maxSlots) {
                    finalStorage[uniqueSlotCount] = StorageSlot({
                        slot: access.slot,
                        value: access.newValue,
                        exists: true
                    });
                    uniqueSlotCount++;
                }
            }
        }
        
        // Always check critical slots for upgradeable contracts
        // Slot 0: Owner (from OwnableUpgradeable)
        bytes32 ownerSlot = bytes32(uint256(0));
        bytes32 ownerValue = vm.load(contractAddr, ownerSlot);
        if (ownerValue != bytes32(0)) {
            bool found = false;
            for (uint256 i = 0; i < uniqueSlotCount; i++) {
                if (finalStorage[i].slot == ownerSlot) {
                    finalStorage[i].value = ownerValue;
                    found = true;
                    break;
                }
            }
            if (!found && uniqueSlotCount < maxSlots) {
                finalStorage[uniqueSlotCount] = StorageSlot({
                    slot: ownerSlot,
                    value: ownerValue,
                    exists: true
                });
                uniqueSlotCount++;
                console.log("Added owner slot 0, value:", vm.toString(address(uint160(uint256(ownerValue)))));
            }
        }
        
        // Check EIP-1967 proxy slots
        bytes32[3] memory proxySlots = [ADMIN_SLOT, IMPLEMENTATION_SLOT, BEACON_SLOT];
        
        for (uint256 p = 0; p < 3; p++) {
            bytes32 slotValue = vm.load(contractAddr, proxySlots[p]);
            if (slotValue != bytes32(0)) {
                // Check if we already have this slot
                bool found = false;
                for (uint256 i = 0; i < uniqueSlotCount; i++) {
                    if (finalStorage[i].slot == proxySlots[p]) {
                        // Update to current value
                        finalStorage[i].value = slotValue;
                        found = true;
                        break;
                    }
                }
                
                // Add if not found and we have space
                if (!found && uniqueSlotCount < maxSlots) {
                    finalStorage[uniqueSlotCount] = StorageSlot({
                        slot: proxySlots[p],
                        value: slotValue,
                        exists: true
                    });
                    uniqueSlotCount++;
                    console.log("Added proxy slot:", vm.toString(uint256(proxySlots[p])), "value:", vm.toString(uint256(slotValue)));
                }
            }
        }

        console.log("Final storage slots for", vm.toString(contractAddr), ":", uniqueSlotCount);

        // Now serialize all the final storage values
        for (uint256 i = 0; i < uniqueSlotCount; i++) {
            if (finalStorage[i].exists) {
                storageJson = vm.serializeBytes32(storageKey, vm.toString(finalStorage[i].slot), finalStorage[i].value);
            }
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

        // Debug: Print what we found
        console.log("Found", deploymentCount, "deployed contracts");
        for (uint256 i = 0; i < deploymentCount; i++) {
            console.log("Contract", i, ":", vm.toString(deployments[i].addr));
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