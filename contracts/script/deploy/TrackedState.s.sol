// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {Vm} from "forge-std/Vm.sol";

abstract contract TrackedState is Script {
    bool public recordStateDiff = true;
    string public stateDiffFilename = "./deployments/state-diff.json";
    
    // EIP-1967 storage slots
    bytes32 constant ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
    bytes32 constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    bytes32 constant BEACON_SLOT = 0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50;

    modifier withStateDiff() {
        if (recordStateDiff) {
            vm.startStateDiffRecording();
        }
        _;
        if (recordStateDiff) {
            Vm.AccountAccess[] memory records = vm.stopAndReturnStateDiff();
            processAndDisplayStateDiff(records);
            exportStateDiff(vm, records, stateDiffFilename);
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
        string name;
    }

    struct StorageChange {
        address account;
        bytes32 slot;
        bytes32 value;  // Just the final value
        string slotName;
    }

    function processAndDisplayStateDiff(Vm.AccountAccess[] memory records) internal view {
        console.log("\n================================================================================");
        console.log("                           STATE DIFF SUMMARY                                   ");
        console.log("================================================================================\n");

        // Collect deployments
        (DeploymentInfo[] memory deployments, uint256 deploymentCount) = collectDeployments(records);
        
        // Collect storage changes
        (StorageChange[] memory storageChanges, uint256 storageChangeCount) = collectStorageChanges(records);

        // Display deployments
        if (deploymentCount > 0) {
            console.log("DEPLOYED CONTRACTS:");
            console.log("-------------------");
            for (uint256 i = 0; i < deploymentCount; i++) {
                console.log("  [%s] %s", i + 1, deployments[i].addr);
                console.log("       Code size: %s bytes", deployments[i].code.length);
                if (bytes(deployments[i].name).length > 0) {
                    console.log("       Contract: %s", deployments[i].name);
                }
            }
            console.log("");
        }

        // Display storage changes grouped by contract
        if (storageChangeCount > 0) {
            console.log("STORAGE CHANGES:");
            console.log("----------------");
            
            address currentContract = address(0);
            for (uint256 i = 0; i < storageChangeCount; i++) {
                StorageChange memory change = storageChanges[i];
                
                if (change.account != currentContract) {
                    if (currentContract != address(0)) console.log("");
                    currentContract = change.account;
                    console.log("  Contract: %s", currentContract);
                }
                
                displayStorageChange(change);
            }
            console.log("");
        }

        // Summary
        console.log("SUMMARY:");
        console.log("--------");
        console.log("  Total state changes: %s", records.length);
        console.log("  Contracts deployed: %s", deploymentCount);
        console.log("  Storage slots modified: %s", storageChangeCount);
        console.log("  State diff exported to: %s", stateDiffFilename);
        console.log("\n================================================================================\n");
    }

    function displayStorageChange(StorageChange memory change) internal pure {
        string memory slotInfo = change.slotName;
        
        if (bytes(slotInfo).length == 0) {
            slotInfo = string.concat("Slot ", vm.toString(uint256(change.slot)));
        }
        
        console.log("    %s", slotInfo);
        console.log("         Value: %s", formatStorageValue(change.value, change.slotName));
    }

    function formatStorageValue(bytes32 value, string memory slotName) internal pure returns (string memory) {
        // For known address slots, format as address
        if (keccak256(bytes(slotName)) == keccak256(bytes("Owner (slot 0)")) ||
            keccak256(bytes(slotName)) == keccak256(bytes("Proxy Admin (EIP-1967)")) ||
            keccak256(bytes(slotName)) == keccak256(bytes("Implementation (EIP-1967)")) ||
            keccak256(bytes(slotName)) == keccak256(bytes("Beacon (EIP-1967)"))) {
            address addr = address(uint160(uint256(value)));
            if (addr == address(0)) return "0x0 (empty)";
            return vm.toString(addr);
        }
        
        // Try to detect if it's likely an address (non-zero in lower 20 bytes, zero in upper 12)
        uint256 uintValue = uint256(value);
        if (uintValue != 0 && uintValue <= type(uint160).max) {
            address addr = address(uint160(uintValue));
            // Additional heuristic: if it looks like a deployed contract address
            if (uint160(addr) > 0xFF) {
                return string.concat(vm.toString(addr), " (likely address)");
            }
        }
        
        // For small numbers, show as decimal
        if (uintValue <= 1e6) {
            return string.concat(vm.toString(uintValue), " (uint256)");
        }
        
        // For everything else, show as hex
        return vm.toString(value);
    }

    function getSlotName(bytes32 slot) internal pure returns (string memory) {
        if (slot == bytes32(uint256(0))) return "Owner (slot 0)";
        if (slot == ADMIN_SLOT) return "Proxy Admin (EIP-1967)";
        if (slot == IMPLEMENTATION_SLOT) return "Implementation (EIP-1967)";
        if (slot == BEACON_SLOT) return "Beacon (EIP-1967)";
        return "";
    }

    function collectDeployments(Vm.AccountAccess[] memory records) internal pure returns (DeploymentInfo[] memory, uint256) {
        uint256 deploymentCount;
        for (uint256 i = 0; i < records.length; i++) {
            if (uint256(records[i].kind) == 4) deploymentCount++; // Create = 4
        }

        if (deploymentCount == 0) {
            return (new DeploymentInfo[](0), 0);
        }

        DeploymentInfo[] memory deployments = new DeploymentInfo[](deploymentCount);
        uint256 n;

        for (uint256 i = 0; i < records.length; i++) {
            if (uint256(records[i].kind) != 4) continue; // Create = 4
            
            address addr = records[i].account;
            bool seen = false;
            
            for (uint256 j = 0; j < n; j++) {
                if (deployments[j].addr == addr) {
                    seen = true;
                    break;
                }
            }
            
            if (!seen) {
                deployments[n].addr = addr;
                deployments[n].code = records[i].deployedCode;
                deployments[n].name = ""; // Could be enhanced to detect contract type
                n++;
            }
        }

        return (deployments, n);
    }

    function collectStorageChanges(Vm.AccountAccess[] memory records) internal pure returns (StorageChange[] memory, uint256) {
        uint256 maxChanges = 1000;
        StorageChange[] memory changes = new StorageChange[](maxChanges);
        uint256 changeCount;

        // Process all records to get only the final storage states
        for (uint256 i = 0; i < records.length; i++) {
            Vm.AccountAccess memory record = records[i];
            
            for (uint256 j = 0; j < record.storageAccesses.length; j++) {
                Vm.StorageAccess memory access = record.storageAccesses[j];
                
                // Skip reads and reverted writes
                if (!access.isWrite || access.reverted) continue;
                
                if (changeCount < maxChanges) {
                    // Check if we already have this slot for this account
                    bool found = false;
                    for (uint256 k = 0; k < changeCount; k++) {
                        if (changes[k].account == record.account && changes[k].slot == access.slot) {
                            // Update to the latest value
                            changes[k].value = access.newValue;
                            found = true;
                            break;
                        }
                    }
                    
                    if (!found) {
                        changes[changeCount] = StorageChange({
                            account: record.account,
                            slot: access.slot,
                            value: access.newValue,
                            slotName: getSlotName(access.slot)
                        });
                        changeCount++;
                    }
                }
            }
        }

        // Create properly sized array with only final states
        StorageChange[] memory result = new StorageChange[](changeCount);
        for (uint256 i = 0; i < changeCount; i++) {
            result[i] = changes[i];
        }

        return (result, changeCount);
    }

    struct StorageSlot {
        bytes32 slot;
        bytes32 value;
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

        // Process all records chronologically to get the final state
        // Later writes to the same slot will overwrite earlier ones
        for (uint256 j = 0; j < records.length; j++) {
            if (records[j].account != contractAddr) continue;

            for (uint256 s = 0; s < records[j].storageAccesses.length; s++) {
                Vm.StorageAccess memory access = records[j].storageAccesses[s];
                
                // Skip reads and reverted writes
                if (!access.isWrite || access.reverted) continue;

                // Find or add slot - always update to latest value
                bool found = false;
                for (uint256 d = 0; d < uniqueSlotCount; d++) {
                    if (finalStorage[d].slot == access.slot) {
                        // Always update to the most recent value
                        finalStorage[d].value = access.newValue;
                        found = true;
                        break;
                    }
                }

                if (!found && uniqueSlotCount < maxSlots) {
                    finalStorage[uniqueSlotCount] = StorageSlot({
                        slot: access.slot,
                        value: access.newValue
                    });
                    uniqueSlotCount++;
                }
            }
        }

        // Serialize only the final storage values
        for (uint256 i = 0; i < uniqueSlotCount; i++) {
            storageJson = vm.serializeBytes32(storageKey, vm.toString(finalStorage[i].slot), finalStorage[i].value);
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