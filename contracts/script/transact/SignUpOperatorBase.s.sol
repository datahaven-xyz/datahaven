// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

// EigenLayer imports
import {IAllocationManagerTypes} from
    "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {StrategyBase} from "eigenlayer-contracts/src/contracts/strategies/StrategyBase.sol";

// OpenZeppelin imports
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Testing imports
import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {Logging} from "../utils/Logging.sol";
import {ELScriptStorage} from "../utils/ELScriptStorage.s.sol";
import {DHScriptStorage} from "../utils/DHScriptStorage.s.sol";
import {Accounts} from "../utils/Accounts.sol";

/**
 * @title SignUpOperatorBase
 * @notice Base contract for signing up different types of operators (Validators, BSPs, MSPs)
 */
abstract contract SignUpOperatorBase is Script, ELScriptStorage, DHScriptStorage, Accounts {
    // Progress indicator
    uint16 public deploymentStep = 0;
    uint16 public totalSteps = 3; // Total major steps

    function _logProgress() internal {
        deploymentStep++;
        Logging.logProgress(deploymentStep, totalSteps);
    }

    /**
     * @notice Abstract method to be implemented by derived contracts to get the operator set ID
     * @return The operator set ID for the specific type (Validator, BSP, MSP)
     */
    function _getOperatorSetId() internal view virtual returns (uint32);

    /**
     * @notice Abstract method to be implemented by derived contracts to add operator to allowlist
     */
    function _addToAllowlist() internal virtual;

    /**
     * @notice Abstract method to get the operator type name (for logging)
     * @return The name of the operator type
     */
    function _getOperatorTypeName() internal view virtual returns (string memory);

    function run() public {
        string memory network = vm.envOr("NETWORK", string("anvil"));
        Logging.logHeader(string.concat("SIGN UP DATAHAVEN ", _getOperatorTypeName()));
        console.log("|  Network: %s", network);
        console.log("|  Timestamp: %s", vm.toString(block.timestamp));
        Logging.logFooter();

        // Read addresses of latest deployment of EigenLayer contracts, for the given network.
        _loadELContracts(network);
        Logging.logInfo(string.concat("Loaded EigenLayer contracts for network: ", network));

        // Read addresses of latest deployment of DataHaven contracts, for the given network.
        _loadDHContracts(network);
        Logging.logInfo(string.concat("Loaded DataHaven contracts for network: ", network));

        _logProgress();

        // STEP 1: Stake tokens into strategies
        Logging.logSection("Staking Tokens into Strategies");

        // Get the deployed strategies and deposit some of the operator's balance into them.
        for (uint256 i = 0; i < deployedStrategies.length; i++) {
            IERC20 linkedToken = StrategyBase(deployedStrategies[i].strategy).underlyingToken();

            // Check that the operator has a balance of the linked token.
            uint256 balance = linkedToken.balanceOf(_operator);
            Logging.logInfo(
                string.concat(
                    "Strategy ",
                    vm.toString(i),
                    " underlying token: ",
                    vm.toString(address(linkedToken)),
                    " - Operator balance: ",
                    vm.toString(balance)
                )
            );

            require(balance > 0, "Operator does not have a balance of the linked token");

            // Stake some of the operator's balance as stake for the strategy.
            vm.startBroadcast(_operatorPrivateKey);
            uint256 balanceToStake = balance / 10;
            linkedToken.approve(address(strategyManager), balanceToStake);
            strategyManager.depositIntoStrategy(
                deployedStrategies[i].strategy, linkedToken, balanceToStake
            );
            vm.stopBroadcast();

            Logging.logStep(
                string.concat(
                    "Staked ", vm.toString(balanceToStake), " tokens for strategy ", vm.toString(i)
                )
            );
        }
        _logProgress();

        // STEP 2: Register as an operator in EigenLayer
        Logging.logSection("Registering as EigenLayer Operator");

        // Register the operator as an operator.
        // We don't set a delegation approver, so that there is no need to sign any messages.
        address initDelegationApprover = address(0);
        uint32 allocationDelay = 0;
        string memory metadataURI = "";
        vm.broadcast(_operatorPrivateKey);
        delegation.registerAsOperator(initDelegationApprover, allocationDelay, metadataURI);
        Logging.logStep(
            string.concat("Registered operator in EigenLayer: ", vm.toString(_operator))
        );

        // Check the staked balance of the operator.
        Logging.logSection("Operator Shares Information");
        for (uint256 i = 0; i < deployedStrategies.length; i++) {
            uint256 operatorShares =
                delegation.operatorShares(_operator, deployedStrategies[i].strategy);
            Logging.logInfo(
                string.concat(
                    "Operator shares for strategy ",
                    vm.toString(i),
                    ": ",
                    vm.toString(operatorShares)
                )
            );
        }
        _logProgress();

        // STEP 3: Register as a DataHaven operator of specific type
        Logging.logSection(string.concat("Registering as DataHaven ", _getOperatorTypeName()));

        // Add the operator to the appropriate allowlist of the DataHaven service.
        _addToAllowlist();
        Logging.logStep(
            string.concat(
                "Added operator to ", _getOperatorTypeName(), " allowlist of DataHaven service"
            )
        );

        // Register the operator as operator for the DataHaven service.
        uint32[] memory operatorSetIds = new uint32[](1);
        operatorSetIds[0] = _getOperatorSetId();
        IAllocationManagerTypes.RegisterParams memory registerParams = IAllocationManagerTypes
            .RegisterParams({
            avs: address(serviceManager),
            operatorSetIds: operatorSetIds,
            data: abi.encodePacked(_operatorSolochainAddress)
        });

        vm.broadcast(_operatorPrivateKey);
        allocationManager.registerForOperatorSets(_operator, registerParams);
        Logging.logStep(
            string.concat("Registered ", _getOperatorTypeName(), " in DataHaven service")
        );

        Logging.logHeader("OPERATOR SETUP COMPLETE");
        Logging.logInfo(string.concat(_getOperatorTypeName(), ": ", vm.toString(_operator)));
        Logging.logInfo(
            string.concat("Successfully configured ", _getOperatorTypeName(), " for DataHaven")
        );
        Logging.logFooter();
    }
}
