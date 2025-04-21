// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

// Testing imports
import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {Logging} from "../utils/Logging.sol";
import {ELScriptStorage} from "../utils/ELScriptStorage.s.sol";
import {DHScriptStorage} from "../utils/DHScriptStorage.s.sol";
import {Accounts} from "../utils/Accounts.sol";

// EigenLayer imports
import {IAllocationManagerTypes} from
    "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {StrategyBase} from "eigenlayer-contracts/src/contracts/strategies/StrategyBase.sol";

// OpenZeppelin imports
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SignUpOperator is Script, ELScriptStorage, DHScriptStorage, Accounts {
    // Progress indicator
    uint16 public deploymentStep = 0;
    uint16 public totalSteps = 3; // Total major steps

    function _logProgress() internal {
        deploymentStep++;
        Logging.logProgress(deploymentStep, totalSteps);
    }

    function run() public {
        string memory network = vm.envOr("NETWORK", string("anvil"));
        Logging.logHeader("SIGN UP DATAHAVEN OPERATOR");
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
            IERC20(linkedToken).approve(address(strategyManager), balanceToStake);
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

        // STEP 3: Register as a DataHaven operator
        Logging.logSection("Registering as DataHaven Operator");

        // Register the operator as operator for the DataHaven service.
        IAllocationManagerTypes.RegisterParams memory registerParams = IAllocationManagerTypes
            .RegisterParams({
            avs: address(serviceManager),
            operatorSetIds: new uint32[](1),
            data: abi.encodePacked(_operatorSolochainAddress)
        });

        vm.broadcast(_operatorPrivateKey);
        allocationManager.registerForOperatorSets(_operator, registerParams);
        Logging.logStep("Registered operator in DataHaven service");

        // // STEP 4: Demonstrate deregistration (for testing purposes)
        // Logging.logSection("Deregistering from DataHaven (Demo)");

        // IAllocationManagerTypes.DeregisterParams memory deregisterParams = IAllocationManagerTypes.DeregisterParams({
        //     avs: address(serviceManager),
        //     operator: _operator,
        //     operatorSetIds: new uint32[](1)
        // });
        // vm.broadcast(_operatorPrivateKey);
        // allocationManager.deregisterFromOperatorSets(deregisterParams);
        // Logging.logStep("Deregistered operator from DataHaven service (for demonstration)");

        Logging.logHeader("OPERATOR SETUP COMPLETE");
        Logging.logInfo(string.concat("Operator: ", vm.toString(_operator)));
        Logging.logInfo("Successfully configured operator for DataHaven");
        Logging.logFooter();
    }
}
