// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

// Testing imports
import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {DeployParams} from "./DeployParams.s.sol";
import {Logging} from "../utils/Logging.sol";
import {Accounts} from "../utils/Accounts.sol";
// Snowbridge imports
import {Gateway} from "snowbridge/src/Gateway.sol";
import {IGatewayV2} from "snowbridge/src/v2/IGateway.sol";
import {GatewayProxy} from "snowbridge/src/GatewayProxy.sol";
import {AgentExecutor} from "snowbridge/src/AgentExecutor.sol";
import {Agent} from "snowbridge/src/Agent.sol";
import {Initializer} from "snowbridge/src/Initializer.sol";
import {OperatingMode} from "snowbridge/src/types/Common.sol";
import {ud60x18} from "snowbridge/lib/prb-math/src/UD60x18.sol";
import {BeefyClient} from "snowbridge/src/BeefyClient.sol";

// OpenZeppelin imports
import {ERC20PresetFixedSupply} from
    "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetFixedSupply.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {ITransparentUpgradeableProxy} from
    "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {TransparentUpgradeableProxy} from
    "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";

// EigenLayer imports
import {AllocationManager} from "eigenlayer-contracts/src/contracts/core/AllocationManager.sol";
import {AVSDirectory} from "eigenlayer-contracts/src/contracts/core/AVSDirectory.sol";
import {DelegationManager} from "eigenlayer-contracts/src/contracts/core/DelegationManager.sol";
import {RewardsCoordinator} from "eigenlayer-contracts/src/contracts/core/RewardsCoordinator.sol";
import {StrategyManager} from "eigenlayer-contracts/src/contracts/core/StrategyManager.sol";
import {IAllocationManagerTypes} from
    "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {IETHPOSDeposit} from "eigenlayer-contracts/src/contracts/interfaces/IETHPOSDeposit.sol";
import {
    IRewardsCoordinator,
    IRewardsCoordinatorTypes
} from "eigenlayer-contracts/src/contracts/interfaces/IRewardsCoordinator.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";
import {PermissionController} from
    "eigenlayer-contracts/src/contracts/permissions/PermissionController.sol";
import {PauserRegistry} from "eigenlayer-contracts/src/contracts/permissions/PauserRegistry.sol";
import {EigenPod} from "eigenlayer-contracts/src/contracts/pods/EigenPod.sol";
import {EigenPodManager} from "eigenlayer-contracts/src/contracts/pods/EigenPodManager.sol";
import {StrategyBaseTVLLimits} from
    "eigenlayer-contracts/src/contracts/strategies/StrategyBaseTVLLimits.sol";
import {EmptyContract} from "eigenlayer-contracts/src/test/mocks/EmptyContract.sol";

// DataHaven imports
import {DataHavenServiceManager} from "../../src/DataHavenServiceManager.sol";
import {MerkleUtils} from "../../src/libraries/MerkleUtils.sol";
import {VetoableSlasher} from "../../src/middleware/VetoableSlasher.sol";
import {RewardsRegistry} from "../../src/middleware/RewardsRegistry.sol";
import {Vm} from "forge-std/Vm.sol";

struct ServiceManagerInitParams {
    address avsOwner;
    address rewardsInitiator;
    address[] validatorsStrategies;
    address[] bspsStrategies;
    address[] mspsStrategies;
    address gateway;
}

// Struct to store more detailed strategy information
struct StrategyInfo {
    address address_;
    address underlyingToken;
    address tokenCreator;
}

contract Deploy is Script, DeployParams, Accounts {
    // Progress indicator
    uint16 public deploymentStep = 0;
    uint16 public totalSteps = 4; // Total major deployment steps

    // State diff recording configuration
    bool public recordStateDiff = true;
    string public stateDiffFilename = "./deployments/state-diff.json";

    // Array to store all state diff records
    Vm.AccountAccess[] private allStateDiffs;

    // EigenLayer Contract declarations
    EmptyContract public emptyContract;
    RewardsCoordinator public rewardsCoordinator;
    RewardsCoordinator public rewardsCoordinatorImplementation;
    PermissionController public permissionController;
    PermissionController public permissionControllerImplementation;
    AllocationManager public allocationManager;
    AllocationManager public allocationManagerImplementation;
    DelegationManager public delegation;
    DelegationManager public delegationImplementation;
    StrategyManager public strategyManager;
    StrategyManager public strategyManagerImplementation;
    AVSDirectory public avsDirectory;
    AVSDirectory public avsDirectoryImplementation;
    EigenPodManager public eigenPodManager;
    EigenPodManager public eigenPodManagerImplementation;
    UpgradeableBeacon public eigenPodBeacon;
    EigenPod public eigenPodImplementation;
    StrategyBaseTVLLimits public baseStrategyImplementation;
    StrategyInfo[] public deployedStrategies;
    IETHPOSDeposit public ethPOSDeposit;

    // EigenLayer required semver
    string public constant SEMVER = "v1.0.0";

    function _logProgress() internal {
        deploymentStep++;
        Logging.logProgress(deploymentStep, totalSteps);
    }

    function _recordBroadcast() private {
        if (recordStateDiff) {
            vm.startStateDiffRecording();
            // The broadcast happens here
            vm.stopAndReturnStateDiff();
            Vm.AccountAccess[] memory newDiffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(newDiffs);
        }
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
        
        // Append new diffs
        for (uint256 i = 0; i < newDiffs.length; i++) {
            combinedDiffs[currentLength + i] = newDiffs[i];
        }
        
        // Update the storage
        allStateDiffs = combinedDiffs;
        
        // Log cumulative state diff count
        if (newDiffs.length > 0) {
            console.log("  [STATE DIFF] Total accumulated state changes: %s", allStateDiffs.length);
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

    // State diff processing functions
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

    function exportStateDiff(Vm vm_, Vm.AccountAccess[] memory records, string memory filename) internal {
        string memory json = buildSimplifiedJson(vm_, records);
        vm_.writeJson(json, filename);
    }

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
    }

    struct StorageSlot {
        bytes32 slot;
        bytes32 value;
    }

    // EIP-1967 storage slots
    bytes32 constant ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
    bytes32 constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    bytes32 constant BEACON_SLOT = 0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50;

    function displayStorageChange(StorageChange memory change) internal view {
        string memory slotInfo = change.slotName;
        
        if (bytes(slotInfo).length == 0) {
            slotInfo = string.concat("Slot ", vm.toString(uint256(change.slot)));
        }
        
        console.log("    %s", slotInfo);
        console.log("         Value: %s", formatStorageValue(change.value, change.slotName));
        
        // Special logging for ownership changes
        if (keccak256(bytes(change.slotName)) == keccak256(bytes("Owner (slot 0)"))) {
            console.log("         [OWNERSHIP CHANGE DETECTED]");
        }
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

        // Process all records chronologically to get the final state
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
            storageJson = vm_.serializeBytes32(storageKey, vm_.toString(finalStorage[i].slot), finalStorage[i].value);
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

    function run() public {
        Logging.logHeader("DATAHAVEN DEPLOYMENT SCRIPT");
        console.log("|  Network: %s", vm.envOr("NETWORK", string("anvil")));
        console.log("|  Timestamp: %s", vm.toString(block.timestamp));
        Logging.logFooter();

        // Load configurations
        SnowbridgeConfig memory snowbridgeConfig = getSnowbridgeConfig();
        AVSConfig memory avsConfig = getAVSConfig();
        EigenLayerConfig memory eigenLayerConfig = getEigenLayerConfig();

        // Deploy EigenLayer core contracts
        Logging.logHeader("EIGENLAYER CORE CONTRACTS DEPLOYMENT");
        Logging.logInfo("Deploying core infrastructure contracts");

        // Deploy proxy admin for ability to upgrade proxy contracts
        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        ProxyAdmin proxyAdmin = new ProxyAdmin();
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logContractDeployed("ProxyAdmin", address(proxyAdmin));

        // Deploy pauser registry
        PauserRegistry pauserRegistry = _deployPauserRegistry(eigenLayerConfig);
        Logging.logContractDeployed("PauserRegistry", address(pauserRegistry));

        // Deploy empty contract to use as initial implementation for proxies
        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        emptyContract = new EmptyContract();
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logContractDeployed("EmptyContract", address(emptyContract));

        // Deploy proxies that will point to implementations
        Logging.logSection("Deploying Proxy Contracts");
        _deployProxies(proxyAdmin);
        Logging.logStep("Initial proxies deployed successfully");

        // Setup ETH2 deposit contract for EigenPod functionality
        ethPOSDeposit = IETHPOSDeposit(getETHPOSDepositAddress());
        Logging.logContractDeployed("ETHPOSDeposit", address(ethPOSDeposit));

        // Deploy EigenPod implementation and beacon
        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        eigenPodImplementation = new EigenPod(
            ethPOSDeposit, eigenPodManager, eigenLayerConfig.beaconChainGenesisTimestamp, SEMVER
        );
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }

        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        eigenPodBeacon = new UpgradeableBeacon(address(eigenPodImplementation));
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logContractDeployed("EigenPod Implementation", address(eigenPodImplementation));
        Logging.logContractDeployed("EigenPod Beacon", address(eigenPodBeacon));

        // Deploy implementation contracts
        Logging.logSection("Deploying Implementation Contracts");
        _deployImplementations(eigenLayerConfig, pauserRegistry);
        Logging.logStep("Implementation contracts deployed successfully");

        // Upgrade proxies to point to implementations and initialise
        Logging.logSection("Initializing Contracts");
        _upgradeAndInitializeProxies(eigenLayerConfig, proxyAdmin);
        Logging.logStep("Proxies upgraded and initialized successfully");

        // Deploy strategy implementation and create strategy proxies
        Logging.logSection("Deploying Strategy Contracts");
        _deployStrategies(pauserRegistry, proxyAdmin);
        Logging.logStep("Strategy contracts deployed successfully");

        // Transfer ownership of core contracts
        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        proxyAdmin.transferOwnership(eigenLayerConfig.executorMultisig);
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
            console.log("  [STATE DIFF] Recorded ProxyAdmin ownership transfer with %s state changes", diffs.length);
        }

        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        eigenPodBeacon.transferOwnership(eigenLayerConfig.executorMultisig);
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
            console.log("  [STATE DIFF] Recorded EigenPodBeacon ownership transfer with %s state changes", diffs.length);
        }
        Logging.logStep("Ownership transferred to multisig");

        Logging.logFooter();
        _logProgress();

        // Deploy Snowbridge and configure Agent
        Logging.logHeader("SNOWBRIDGE DEPLOYMENT");

        (
            BeefyClient beefyClient,
            AgentExecutor agentExecutor,
            IGatewayV2 gateway,
            address payable rewardsAgentAddress
        ) = _deploySnowbridge(snowbridgeConfig);

        Logging.logFooter();
        _logProgress();

        // Deploy DataHaven custom contracts
        (
            DataHavenServiceManager serviceManager,
            VetoableSlasher vetoableSlasher,
            RewardsRegistry rewardsRegistry
        ) = _deployDataHavenContracts(avsConfig, proxyAdmin, gateway);

        Logging.logFooter();
        _logProgress();

        // Set the Agent in the RewardsRegistry
        Logging.logHeader("FINAL CONFIGURATION");
        // This needs to be executed by the AVS owner
        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_avsOwnerPrivateKey);
        serviceManager.setRewardsAgent(0, address(rewardsAgentAddress));
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logStep("Agent set in RewardsRegistry");
        Logging.logContractDeployed("Agent Address", rewardsAgentAddress);

        Logging.logFooter();
        _logProgress();

        // Output all deployed contract addresses
        _outputDeployedAddresses(
            beefyClient,
            agentExecutor,
            gateway,
            serviceManager,
            vetoableSlasher,
            rewardsRegistry,
            rewardsAgentAddress
        );

        // Process and export final state diff
        if (recordStateDiff && allStateDiffs.length > 0) {
            processAndDisplayStateDiff(allStateDiffs);
            exportStateDiff(vm, allStateDiffs, stateDiffFilename);
        }
    }

    function _deploySnowbridge(
        SnowbridgeConfig memory config
    ) internal returns (BeefyClient, AgentExecutor, IGatewayV2, address payable) {
        Logging.logSection("Deploying Snowbridge Core Components");

        BeefyClient beefyClient = _deployBeefyClient(config);
        Logging.logContractDeployed("BeefyClient", address(beefyClient));

        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        AgentExecutor agentExecutor = new AgentExecutor();
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logContractDeployed("AgentExecutor", address(agentExecutor));

        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        Gateway gatewayImplementation = new Gateway(address(beefyClient), address(agentExecutor));
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logContractDeployed("Gateway Implementation", address(gatewayImplementation));

        // Configure and deploy Gateway proxy
        OperatingMode defaultOperatingMode = OperatingMode.Normal;
        Initializer.Config memory gatewayConfig = Initializer.Config({
            mode: defaultOperatingMode,
            deliveryCost: 1,
            registerTokenFee: 1,
            assetHubCreateAssetFee: 1,
            assetHubReserveTransferFee: 1,
            exchangeRate: ud60x18(1),
            multiplier: ud60x18(1),
            foreignTokenDecimals: 18,
            maxDestinationFee: 1
        });

        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        IGatewayV2 gateway = IGatewayV2(
            address(new GatewayProxy(address(gatewayImplementation), abi.encode(gatewayConfig)))
        );
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logContractDeployed("Gateway Proxy", address(gateway));

        // Create Agent
        Logging.logSection("Creating Snowbridge Agent");
        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        gateway.v2_createAgent(config.rewardsMessageOrigin);
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        address payable rewardsAgentAddress = payable(gateway.agentOf(config.rewardsMessageOrigin));
        Logging.logContractDeployed("Rewards Agent", rewardsAgentAddress);

        return (beefyClient, agentExecutor, gateway, rewardsAgentAddress);
    }

    function _deployProxies(
        ProxyAdmin proxyAdmin
    ) internal {
        // Deploy proxies with empty implementation initially
        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        delegation = DelegationManager(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logContractDeployed("DelegationManager Proxy", address(delegation));

        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        strategyManager = StrategyManager(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logContractDeployed("StrategyManager Proxy", address(strategyManager));

        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        avsDirectory = AVSDirectory(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logContractDeployed("AVSDirectory Proxy", address(avsDirectory));

        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        eigenPodManager = EigenPodManager(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logContractDeployed("EigenPodManager Proxy", address(eigenPodManager));

        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        rewardsCoordinator = RewardsCoordinator(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logContractDeployed("RewardsCoordinator Proxy", address(rewardsCoordinator));

        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        allocationManager = AllocationManager(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logContractDeployed("AllocationManager Proxy", address(allocationManager));

        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        permissionController = PermissionController(
            address(
                new TransparentUpgradeableProxy(address(emptyContract), address(proxyAdmin), "")
            )
        );
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logContractDeployed("PermissionController Proxy", address(permissionController));
    }

    function _deployImplementations(
        EigenLayerConfig memory config,
        PauserRegistry pauserRegistry
    ) internal {
        // Deploy implementation contracts
        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        delegationImplementation = new DelegationManager(
            strategyManager,
            eigenPodManager,
            allocationManager,
            pauserRegistry,
            permissionController,
            config.minWithdrawalDelayBlocks,
            SEMVER
        );
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logContractDeployed(
            "DelegationManager Implementation", address(delegationImplementation)
        );

        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        strategyManagerImplementation = new StrategyManager(delegation, pauserRegistry, SEMVER);
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logContractDeployed(
            "StrategyManager Implementation", address(strategyManagerImplementation)
        );

        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        avsDirectoryImplementation = new AVSDirectory(delegation, pauserRegistry, SEMVER);
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logContractDeployed(
            "AVSDirectory Implementation", address(avsDirectoryImplementation)
        );

        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        eigenPodManagerImplementation =
            new EigenPodManager(ethPOSDeposit, eigenPodBeacon, delegation, pauserRegistry, SEMVER);
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logContractDeployed(
            "EigenPodManager Implementation", address(eigenPodManagerImplementation)
        );

        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        rewardsCoordinatorImplementation = new RewardsCoordinator(
            IRewardsCoordinatorTypes.RewardsCoordinatorConstructorParams(
                delegation,
                strategyManager,
                allocationManager,
                pauserRegistry,
                permissionController,
                config.calculationIntervalSeconds,
                config.maxRewardsDuration,
                config.maxRetroactiveLength,
                config.maxFutureLength,
                config.genesisRewardsTimestamp,
                SEMVER
            )
        );
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logContractDeployed(
            "RewardsCoordinator Implementation", address(rewardsCoordinatorImplementation)
        );

        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        allocationManagerImplementation = new AllocationManager(
            delegation,
            pauserRegistry,
            permissionController,
            config.deallocationDelay,
            config.allocationConfigurationDelay,
            SEMVER
        );
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logContractDeployed(
            "AllocationManager Implementation", address(allocationManagerImplementation)
        );

        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        permissionControllerImplementation = new PermissionController(SEMVER);
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logContractDeployed(
            "PermissionController Implementation", address(permissionControllerImplementation)
        );
    }

    function _upgradeAndInitializeProxies(
        EigenLayerConfig memory config,
        ProxyAdmin proxyAdmin
    ) internal {
        // Initialize DelegationManager
        {
            IStrategy[] memory strategies;
            uint256[] memory withdrawalDelayBlocks;

            if (recordStateDiff) vm.startStateDiffRecording();
            vm.broadcast(_deployerPrivateKey);
            proxyAdmin.upgradeAndCall(
                ITransparentUpgradeableProxy(payable(address(delegation))),
                address(delegationImplementation),
                abi.encodeWithSelector(
                    DelegationManager.initialize.selector,
                    config.executorMultisig,
                    config.delegationInitPausedStatus,
                    config.delegationWithdrawalDelayBlocks,
                    strategies,
                    withdrawalDelayBlocks
                )
            );
            if (recordStateDiff) {
                Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
                _appendStateDiffs(diffs);
            }
            Logging.logStep("DelegationManager initialized");
        }

        // Initialize StrategyManager
        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        proxyAdmin.upgradeAndCall(
            ITransparentUpgradeableProxy(payable(address(strategyManager))),
            address(strategyManagerImplementation),
            abi.encodeWithSelector(
                StrategyManager.initialize.selector,
                config.executorMultisig,
                config.operationsMultisig,
                config.strategyManagerInitPausedStatus
            )
        );
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logStep("StrategyManager initialized");

        // Initialize AVSDirectory
        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        proxyAdmin.upgradeAndCall(
            ITransparentUpgradeableProxy(payable(address(avsDirectory))),
            address(avsDirectoryImplementation),
            abi.encodeWithSelector(
                AVSDirectory.initialize.selector,
                config.executorMultisig,
                0 // Initial paused status
            )
        );
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logStep("AVSDirectory initialized");

        // Initialize EigenPodManager
        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        proxyAdmin.upgradeAndCall(
            ITransparentUpgradeableProxy(payable(address(eigenPodManager))),
            address(eigenPodManagerImplementation),
            abi.encodeWithSelector(
                EigenPodManager.initialize.selector,
                config.executorMultisig,
                config.eigenPodManagerInitPausedStatus
            )
        );
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logStep("EigenPodManager initialized");

        // Initialize RewardsCoordinator
        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        proxyAdmin.upgradeAndCall(
            ITransparentUpgradeableProxy(payable(address(rewardsCoordinator))),
            address(rewardsCoordinatorImplementation),
            abi.encodeWithSelector(
                RewardsCoordinator.initialize.selector,
                config.executorMultisig,
                config.rewardsCoordinatorInitPausedStatus,
                config.rewardsUpdater,
                config.activationDelay,
                config.globalCommissionBips
            )
        );
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logStep("RewardsCoordinator initialized");

        // Initialize AllocationManager
        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        proxyAdmin.upgradeAndCall(
            ITransparentUpgradeableProxy(payable(address(allocationManager))),
            address(allocationManagerImplementation),
            abi.encodeWithSelector(
                AllocationManager.initialize.selector,
                config.executorMultisig,
                config.allocationManagerInitPausedStatus
            )
        );
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logStep("AllocationManager initialized");

        // Initialize PermissionController (no initialization function)
        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        proxyAdmin.upgrade(
            ITransparentUpgradeableProxy(payable(address(permissionController))),
            address(permissionControllerImplementation)
        );
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logStep("PermissionController upgraded");
    }

    function _deployStrategies(PauserRegistry pauserRegistry, ProxyAdmin proxyAdmin) internal {
        // Deploy base strategy implementation
        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        baseStrategyImplementation =
            new StrategyBaseTVLLimits(strategyManager, pauserRegistry, SEMVER);
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logContractDeployed("Strategy Implementation", address(baseStrategyImplementation));

        // Create default test token and strategy if needed
        // In a production environment, this would be replaced with actual token addresses.
        if (block.chainid != 1) {
            // We mint tokens to the operator account so that it then has a balance to deposit as stake.
            if (recordStateDiff) vm.startStateDiffRecording();
            vm.broadcast(_deployerPrivateKey);
            address testToken =
                address(new ERC20PresetFixedSupply("TestToken", "TEST", 1000000 ether, _operator));
            if (recordStateDiff) {
                Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
                _appendStateDiffs(diffs);
            }
            Logging.logContractDeployed("TestToken", testToken);

            // Create strategy for test token
            if (recordStateDiff) vm.startStateDiffRecording();
            vm.broadcast(_deployerPrivateKey);
            StrategyBaseTVLLimits strategy = StrategyBaseTVLLimits(
                address(
                    new TransparentUpgradeableProxy(
                        address(baseStrategyImplementation),
                        address(proxyAdmin),
                        abi.encodeWithSelector(
                            StrategyBaseTVLLimits.initialize.selector,
                            1000000 ether, // maxPerDeposit
                            10000000 ether, // maxDeposits
                            IERC20(testToken)
                        )
                    )
                )
            );
            if (recordStateDiff) {
                Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
                _appendStateDiffs(diffs);
            }

            // Store the strategy with its token information
            deployedStrategies.push(
                StrategyInfo({
                    address_: address(strategy),
                    underlyingToken: testToken,
                    tokenCreator: _operator
                })
            );
            Logging.logContractDeployed("Test Strategy", address(strategy));
        }

        // Whitelist strategies in the strategy manager
        IStrategy[] memory strategies = new IStrategy[](deployedStrategies.length);
        for (uint256 i = 0; i < deployedStrategies.length; i++) {
            strategies[i] = IStrategy(deployedStrategies[i].address_);
        }
        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_operationsMultisigPrivateKey);
        strategyManager.addStrategiesToDepositWhitelist(strategies);
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
    }

    function _deployProxyAdmin() internal returns (ProxyAdmin) {
        if (recordStateDiff) vm.startStateDiffRecording();
        ProxyAdmin proxyAdmin = new ProxyAdmin();
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        return proxyAdmin;
    }

    function _deployPauserRegistry(
        EigenLayerConfig memory config
    ) internal returns (PauserRegistry) {
        // Use the array of pauser addresses directly from the config
        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        PauserRegistry registry = new PauserRegistry(config.pauserAddresses, config.unpauserAddress);
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        return registry;
    }

    function _buildValidatorSet(
        uint128 id,
        bytes32[] memory validators
    ) internal pure returns (BeefyClient.ValidatorSet memory) {
        // Calculate the merkle root from the validators array using the shared library
        bytes32 merkleRoot = MerkleUtils.calculateMerkleRootUnsorted(validators);

        // Create and return the validator set with the calculated merkle root
        return
            BeefyClient.ValidatorSet({id: id, length: uint128(validators.length), root: merkleRoot});
    }

    function _deployBeefyClient(
        SnowbridgeConfig memory config
    ) internal returns (BeefyClient) {
        // Create validator sets using the MerkleUtils library
        BeefyClient.ValidatorSet memory validatorSet =
            _buildValidatorSet(0, config.initialValidators);
        BeefyClient.ValidatorSet memory nextValidatorSet =
            _buildValidatorSet(1, config.nextValidators);

        // Deploy BeefyClient
        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        BeefyClient client = new BeefyClient(
            config.randaoCommitDelay,
            config.randaoCommitExpiration,
            config.minNumRequiredSignatures,
            config.startBlock,
            validatorSet,
            nextValidatorSet
        );
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        return client;
    }

    function _outputDeployedAddresses(
        BeefyClient beefyClient,
        AgentExecutor agentExecutor,
        IGatewayV2 gateway,
        DataHavenServiceManager serviceManager,
        VetoableSlasher vetoableSlasher,
        RewardsRegistry rewardsRegistry,
        address agent
    ) internal {
        Logging.logHeader("DEPLOYMENT SUMMARY");

        Logging.logSection("Snowbridge Contracts");
        Logging.logContractDeployed("BeefyClient", address(beefyClient));
        Logging.logContractDeployed("AgentExecutor", address(agentExecutor));
        Logging.logContractDeployed("Gateway", address(gateway));
        Logging.logContractDeployed("Agent", agent);

        Logging.logSection("DataHaven Contracts");
        Logging.logContractDeployed("ServiceManager", address(serviceManager));
        Logging.logContractDeployed("VetoableSlasher", address(vetoableSlasher));
        Logging.logContractDeployed("RewardsRegistry", address(rewardsRegistry));

        Logging.logSection("EigenLayer Core Contracts");
        Logging.logContractDeployed("DelegationManager", address(delegation));
        Logging.logContractDeployed("StrategyManager", address(strategyManager));
        Logging.logContractDeployed("AVSDirectory", address(avsDirectory));
        Logging.logContractDeployed("EigenPodManager", address(eigenPodManager));
        Logging.logContractDeployed("EigenPodBeacon", address(eigenPodBeacon));
        Logging.logContractDeployed("RewardsCoordinator", address(rewardsCoordinator));
        Logging.logContractDeployed("AllocationManager", address(allocationManager));
        Logging.logContractDeployed("PermissionController", address(permissionController));
        Logging.logContractDeployed("ETHPOSDeposit", address(ethPOSDeposit));

        Logging.logSection("Strategy Contracts");
        Logging.logContractDeployed(
            "BaseStrategyImplementation", address(baseStrategyImplementation)
        );
        for (uint256 i = 0; i < deployedStrategies.length; i++) {
            Logging.logContractDeployed(
                string.concat("DeployedStrategy", vm.toString(i)), deployedStrategies[i].address_
            );
        }

        Logging.logFooter();

        // Write to deployment file for future reference
        string memory network = vm.envOr("NETWORK", string("anvil"));
        string memory deploymentPath =
            string.concat(vm.projectRoot(), "/deployments/", network, ".json");

        // Create directory if it doesn't exist
        vm.createDir(string.concat(vm.projectRoot(), "/deployments"), true);

        // Create JSON with deployed addresses
        string memory json = "{";
        json = string.concat(json, '"network": "', network, '",');

        // Snowbridge contracts
        json = string.concat(json, '"BeefyClient": "', vm.toString(address(beefyClient)), '",');
        json = string.concat(json, '"AgentExecutor": "', vm.toString(address(agentExecutor)), '",');
        json = string.concat(json, '"Gateway": "', vm.toString(address(gateway)), '",');
        json =
            string.concat(json, '"ServiceManager": "', vm.toString(address(serviceManager)), '",');
        json =
            string.concat(json, '"VetoableSlasher": "', vm.toString(address(vetoableSlasher)), '",');
        json =
            string.concat(json, '"RewardsRegistry": "', vm.toString(address(rewardsRegistry)), '",');
        json = string.concat(json, '"Agent": "', vm.toString(agent), '",');

        // EigenLayer contracts
        json = string.concat(json, '"DelegationManager": "', vm.toString(address(delegation)), '",');
        json =
            string.concat(json, '"StrategyManager": "', vm.toString(address(strategyManager)), '",');
        json = string.concat(json, '"AVSDirectory": "', vm.toString(address(avsDirectory)), '",');
        json =
            string.concat(json, '"EigenPodManager": "', vm.toString(address(eigenPodManager)), '",');
        json =
            string.concat(json, '"EigenPodBeacon": "', vm.toString(address(eigenPodBeacon)), '",');
        json = string.concat(
            json, '"RewardsCoordinator": "', vm.toString(address(rewardsCoordinator)), '",'
        );
        json = string.concat(
            json, '"AllocationManager": "', vm.toString(address(allocationManager)), '",'
        );
        json = string.concat(
            json, '"PermissionController": "', vm.toString(address(permissionController)), '",'
        );
        json = string.concat(json, '"ETHPOSDeposit": "', vm.toString(address(ethPOSDeposit)), '",');
        json = string.concat(
            json,
            '"BaseStrategyImplementation": "',
            vm.toString(address(baseStrategyImplementation)),
            '"'
        );

        // Add strategies with token information
        if (deployedStrategies.length > 0) {
            json = string.concat(json, ",");
            json = string.concat(json, '"DeployedStrategies": [');

            for (uint256 i = 0; i < deployedStrategies.length; i++) {
                json = string.concat(json, "{");
                json = string.concat(
                    json, '"address": "', vm.toString(deployedStrategies[i].address_), '",'
                );
                json = string.concat(
                    json,
                    '"underlyingToken": "',
                    vm.toString(deployedStrategies[i].underlyingToken),
                    '",'
                );
                json = string.concat(
                    json, '"tokenCreator": "', vm.toString(deployedStrategies[i].tokenCreator), '"'
                );
                json = string.concat(json, "}");

                // Add comma if not the last element
                if (i < deployedStrategies.length - 1) {
                    json = string.concat(json, ",");
                }
            }

            json = string.concat(json, "]");
        }

        json = string.concat(json, "}");

        // Write to file
        vm.writeFile(deploymentPath, json);
        Logging.logInfo(string.concat("Deployment info saved to: ", deploymentPath));
    }

    function _deployDataHavenContracts(
        AVSConfig memory avsConfig,
        ProxyAdmin proxyAdmin,
        IGatewayV2 gateway
    ) internal returns (DataHavenServiceManager, VetoableSlasher, RewardsRegistry) {
        Logging.logHeader("DATAHAVEN CUSTOM CONTRACTS DEPLOYMENT");

        // Deploy the Service Manager
        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        DataHavenServiceManager serviceManagerImplementation =
            new DataHavenServiceManager(rewardsCoordinator, permissionController, allocationManager);
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logContractDeployed(
            "ServiceManager Implementation", address(serviceManagerImplementation)
        );

        // Extract strategies logic to a helper function to reduce local variables
        _prepareStrategiesForServiceManager(avsConfig, deployedStrategies);

        // Create service manager initialisation parameters struct to reduce stack variables
        ServiceManagerInitParams memory initParams = ServiceManagerInitParams({
            avsOwner: avsConfig.avsOwner,
            rewardsInitiator: avsConfig.rewardsInitiator,
            validatorsStrategies: avsConfig.validatorsStrategies,
            bspsStrategies: avsConfig.bspsStrategies,
            mspsStrategies: avsConfig.mspsStrategies,
            gateway: address(gateway)
        });

        // Create the service manager proxy
        DataHavenServiceManager serviceManager =
            _createServiceManagerProxy(serviceManagerImplementation, proxyAdmin, initParams);
        Logging.logContractDeployed("ServiceManager Proxy", address(serviceManager));

        // Deploy VetoableSlasher
        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        VetoableSlasher vetoableSlasher = new VetoableSlasher(
            allocationManager,
            serviceManager,
            avsConfig.vetoCommitteeMember,
            avsConfig.vetoWindowBlocks
        );
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logContractDeployed("VetoableSlasher", address(vetoableSlasher));

        // Deploy RewardsRegistry
        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        RewardsRegistry rewardsRegistry = new RewardsRegistry(
            address(serviceManager),
            address(0) // Will be set to the Agent address after creation
        );
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logContractDeployed("RewardsRegistry", address(rewardsRegistry));

        Logging.logSection("Configuring Service Manager");

        // Register the DataHaven service in the AllocationManager
        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_avsOwnerPrivateKey);
        serviceManager.updateAVSMetadataURI("");
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logStep("DataHaven service registered in AllocationManager");

        // Set the slasher in the ServiceManager
        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_avsOwnerPrivateKey);
        serviceManager.setSlasher(vetoableSlasher);
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logStep("Slasher set in ServiceManager");

        // Set the RewardsRegistry in the ServiceManager
        uint32 validatorsSetId = serviceManager.VALIDATORS_SET_ID();
        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_avsOwnerPrivateKey);
        serviceManager.setRewardsRegistry(validatorsSetId, rewardsRegistry);
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }
        Logging.logStep("RewardsRegistry set in ServiceManager");

        return (serviceManager, vetoableSlasher, rewardsRegistry);
    }

    function _createServiceManagerProxy(
        DataHavenServiceManager implementation,
        ProxyAdmin proxyAdmin,
        ServiceManagerInitParams memory params
    ) internal returns (DataHavenServiceManager) {
        if (recordStateDiff) vm.startStateDiffRecording();
        vm.broadcast(_deployerPrivateKey);
        bytes memory initData = abi.encodeWithSelector(
            DataHavenServiceManager.initialise.selector,
            params.avsOwner,
            params.rewardsInitiator,
            params.validatorsStrategies,
            params.bspsStrategies,
            params.mspsStrategies,
            params.gateway
        );

        TransparentUpgradeableProxy proxy =
            new TransparentUpgradeableProxy(address(implementation), address(proxyAdmin), initData);
        
        if (recordStateDiff) {
            Vm.AccountAccess[] memory diffs = vm.stopAndReturnStateDiff();
            _appendStateDiffs(diffs);
        }

        return DataHavenServiceManager(address(proxy));
    }

    function _prepareStrategiesForServiceManager(
        AVSConfig memory config,
        StrategyInfo[] memory strategies
    ) internal pure {
        if (config.validatorsStrategies.length == 0) {
            config.validatorsStrategies = new address[](strategies.length);
            config.bspsStrategies = new address[](strategies.length);
            config.mspsStrategies = new address[](strategies.length);
            for (uint256 i = 0; i < strategies.length; i++) {
                config.validatorsStrategies[i] = strategies[i].address_;
                config.bspsStrategies[i] = strategies[i].address_;
                config.mspsStrategies[i] = strategies[i].address_;
            }
        }
    }
}