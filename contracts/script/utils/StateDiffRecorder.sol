// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {Vm} from "forge-std/Vm.sol";

abstract contract StateDiffRecorder is Script {
    // State diff recording configuration
    bool public recordStateDiff = true;
    string public stateDiffFilename = "./deployments/state-diff.json";
    
    // Array to store all state diff records
    Vm.AccountAccess[] private allStateDiffs;
    
    // Helper structs for state diff processing
    struct DeploymentInfo {
        address addr;
        bytes code;
        string name;
    }

    struct StorageChange {
        address account;
        bytes32 slot;
        bytes32 value;
        string slotName;
        bool isDelegateCall;
        address implementation;
    }

    struct StorageSlot {
        bytes32 slot;
        bytes32 value;
    }

    // EIP-1967 storage slots
    bytes32 constant ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
    bytes32 constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    bytes32 constant BEACON_SLOT = 0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50;

    modifier trackStateDiff() {
        if (recordStateDiff) {
            vm.startStateDiffRecording();
        }
        _;
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
    }

    // Control functions for state diff recording
    function disableStateDiff() public {
        recordStateDiff = false;
    }

    function enableStateDiff() public {
        recordStateDiff = true;
    }

    function setStateDiffFilename(string memory filename) public {
        stateDiffFilename = filename;
    }

    function _appendStateDiffs(Vm.AccountAccess[] memory newDiffs) private {
        uint256 currentLength = allStateDiffs.length;
        uint256 newLength = currentLength + newDiffs.length;
        
        // Create a new array with the combined size
        Vm.AccountAccess[] memory combinedDiffs = new Vm.AccountAccess[](newLength);
        
        // Copy existing diffs
        for (uint256 i = 0; i < currentLength; i++) {
            combinedDiffs[i] = allStateDiffs[i];
        }
        
        // Append new diffs and track storage changes
        for (uint256 i = 0; i < newDiffs.length; i++) {
            combinedDiffs[currentLength + i] = newDiffs[i];
            
            // Track storage writes
            for (uint256 j = 0; j < newDiffs[i].storageAccesses.length; j++) {
                Vm.StorageAccess memory access = newDiffs[i].storageAccesses[j];
                if (access.isWrite && !access.reverted) {
                    string memory slotInfo = getSlotName(access.slot);
                    if (bytes(slotInfo).length == 0) {
                        slotInfo = string.concat("Slot ", vm.toString(uint256(access.slot)));
                    }
                    console.log("  [STORAGE] %s: %s = %s", access.account, slotInfo, vm.toString(access.newValue));
                }
            }
        }
        
        // Update the storage
        allStateDiffs = combinedDiffs;
    }

    function getSlotName(bytes32 slot) internal pure returns (string memory) {
        if (slot == bytes32(uint256(0))) return "Owner (slot 0)";
        if (slot == ADMIN_SLOT) return "Proxy Admin (EIP-1967)";
        if (slot == IMPLEMENTATION_SLOT) return "Implementation (EIP-1967)";
        if (slot == BEACON_SLOT) return "Beacon (EIP-1967)";
        return "";
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
                
                // Simple one-line display
                string memory slotName = bytes(change.slotName).length > 0 ? change.slotName : string.concat("Slot ", vm.toString(uint256(change.slot)));
                console.log("    %s = %s", slotName, vm.toString(change.value));
                if (change.isDelegateCall) {
                    console.log("      (via delegatecall from %s)", change.implementation);
                }
            }
            console.log("");
        }

        // Summary
        console.log("SUMMARY:");
        console.log("--------");
        console.log("  Total state changes: %s", records.length);
        console.log("  Contracts deployed: %s", deploymentCount);
        console.log("  Storage slots modified: %s", storageChangeCount);
        
        // Count delegate call state changes
        uint256 delegateCallChanges = 0;
        for (uint256 i = 0; i < storageChangeCount; i++) {
            if (storageChanges[i].isDelegateCall) {
                delegateCallChanges++;
            }
        }
        if (delegateCallChanges > 0) {
            console.log("  Delegate call state changes: %s", delegateCallChanges);
        }
        
        console.log("  State diff exported to: %s", stateDiffFilename);
        console.log("\n================================================================================\n");
    }

    function exportStateDiff(Vm vm_, Vm.AccountAccess[] memory records, string memory filename) internal {
        string memory json = buildSimplifiedJson(vm_, records);
        vm_.writeJson(json, filename);
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
                
                // Determine which account actually owns this storage
                address stateAccount = access.account;
                
                // Check if this storage access is from a delegate call
                bool isDelegateCall = (uint256(record.kind) == 1 && record.accessor != record.account);
                address implementation = isDelegateCall ? record.account : address(0);
                
                // Skip reads and reverted writes
                if (!access.isWrite || access.reverted) continue;
                
                if (changeCount < maxChanges) {
                    // Check if we already have this slot for this account
                    bool found = false;
                    for (uint256 k = 0; k < changeCount; k++) {
                        if (changes[k].account == stateAccount && changes[k].slot == access.slot) {
                            // Update to the latest value
                            changes[k].value = access.newValue;
                            // Update delegate call info if this is now from a delegate call
                            if (isDelegateCall && !changes[k].isDelegateCall) {
                                changes[k].isDelegateCall = true;
                                changes[k].implementation = implementation;
                            }
                            found = true;
                            break;
                        }
                    }
                    
                    if (!found) {
                        changes[changeCount] = StorageChange({
                            account: stateAccount,
                            slot: access.slot,
                            value: access.newValue,
                            slotName: getSlotName(access.slot),
                            isDelegateCall: isDelegateCall,
                            implementation: implementation
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

    function processStorageForContract(
        Vm vm_,
        address contractAddr,
        Vm.AccountAccess[] memory records,
        string memory storageKey
    ) internal returns (string memory) {
        uint256 maxSlots = 200;
        StorageSlot[] memory finalStorage = new StorageSlot[](maxSlots);
        uint256 uniqueSlotCount;
        string memory storageJson = "";
        
        // Debug for specific contracts
        bool isDebugContract = (contractAddr == 0x36C02dA8a0983159322a80FFE9F24b1acfF8B570);
        if (isDebugContract) {
            console.log("[processStorageForContract] Processing %s", contractAddr);
        }

        // Process all records chronologically to get the final state
        for (uint256 j = 0; j < records.length; j++) {
            // Check if this record has any storage accesses for our contract
            bool hasStorageForContract = false;
            for (uint256 k = 0; k < records[j].storageAccesses.length; k++) {
                if (records[j].storageAccesses[k].account == contractAddr) {
                    hasStorageForContract = true;
                    break;
                }
            }
            
            if (!hasStorageForContract) continue;
            
            if (isDebugContract && records[j].storageAccesses.length > 0) {
                console.log("  [processStorage] Found record %s with %s storage accesses", j, records[j].storageAccesses.length);
            }

            for (uint256 s = 0; s < records[j].storageAccesses.length; s++) {
                Vm.StorageAccess memory access = records[j].storageAccesses[s];
                
                // Only process storage accesses for our contract
                if (access.account != contractAddr) continue;
                
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
                    
                    if (isDebugContract) {
                        console.log("  [processStorage] Added slot %s = %s", vm.toString(access.slot), vm.toString(access.newValue));
                    }
                }
            }
        }

        // Serialize only the final storage values
        if (isDebugContract) {
            console.log("  [processStorage] Total slots to serialize: %s", uniqueSlotCount);
        }
        for (uint256 i = 0; i < uniqueSlotCount; i++) {
            storageJson = vm_.serializeBytes32(storageKey, vm_.toString(finalStorage[i].slot), finalStorage[i].value);
            if (isDebugContract) {
                console.log("  [processStorage] Serialized slot %s", vm_.toString(finalStorage[i].slot));
            }
        }

        return storageJson;
    }

    function buildSimplifiedJson(Vm vm_, Vm.AccountAccess[] memory records) internal returns (string memory) {
        if (records.length == 0) {
            return vm_.serializeString("contracts", "empty", "[]");
        }

        (DeploymentInfo[] memory deployments, uint256 deploymentCount) = collectDeployments(records);

        if (deploymentCount == 0) {
            return vm_.serializeString("contracts", "empty", "[]");
        }

        string memory jsonKey = "contracts";
        string memory finalJson = "";

        for (uint256 i = 0; i < deploymentCount; i++) {
            string memory contractKey = string.concat("contract_", vm_.toString(i));

            vm_.serializeAddress(contractKey, "address", deployments[i].addr);
            vm_.serializeBytes(contractKey, "code", deployments[i].code);

            string memory storageKey = string.concat(contractKey, "_storage");
            string memory storageJson = processStorageForContract(vm_, deployments[i].addr, records, storageKey);

            string memory contractJson = vm_.serializeString(contractKey, "storage", storageJson);

            if (i == deploymentCount - 1) {
                finalJson = vm_.serializeString(jsonKey, vm_.toString(i), contractJson);
            } else {
                vm_.serializeString(jsonKey, vm_.toString(i), contractJson);
            }
        }

        return finalJson;
    }

    function finalizeStateDiff() internal {
        if (recordStateDiff && allStateDiffs.length > 0) {
            processAndDisplayStateDiff(allStateDiffs);
            exportStateDiff(vm, allStateDiffs, stateDiffFilename);
        }
    }
}