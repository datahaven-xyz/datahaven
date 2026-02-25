// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

// EigenLayer imports
import {
    IAllocationManagerTypes
} from "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {OperatorSet} from "eigenlayer-contracts/src/contracts/libraries/OperatorSetLib.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";

// Testing imports
import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {Logging} from "../utils/Logging.sol";
import {ELScriptStorage} from "../utils/ELScriptStorage.s.sol";
import {DHScriptStorage} from "../utils/DHScriptStorage.s.sol";
import {Accounts} from "../utils/Accounts.sol";

/**
 * @title AllocateOperatorStake
 * @notice Allocates full magnitude to the validator operator set.
 *         Must be run AFTER SignUpValidator (needs at least 1 block gap
 *         for the allocation delay to initialize).
 */
contract AllocateOperatorStake is Script, ELScriptStorage, DHScriptStorage, Accounts {
    function run() public {
        string memory network = vm.envOr("NETWORK", string("anvil"));
        Logging.logHeader("ALLOCATE OPERATOR STAKE");
        console.log("|  Network: %s", network);
        Logging.logFooter();

        _loadELContracts(network);
        _loadDHContracts(network);

        IStrategy[] memory strategies = new IStrategy[](deployedStrategies.length);
        for (uint256 i = 0; i < deployedStrategies.length; i++) {
            strategies[i] = IStrategy(address(deployedStrategies[i].strategy));
        }

        uint64[] memory newMagnitudes = new uint64[](strategies.length);
        for (uint256 i = 0; i < strategies.length; i++) {
            newMagnitudes[i] = 1e18;
        }

        IAllocationManagerTypes.AllocateParams[] memory allocParams =
            new IAllocationManagerTypes.AllocateParams[](1);
        allocParams[0] = IAllocationManagerTypes.AllocateParams({
            operatorSet: OperatorSet({
                avs: address(serviceManager), id: serviceManager.VALIDATORS_SET_ID()
            }),
            strategies: strategies,
            newMagnitudes: newMagnitudes
        });

        vm.broadcast(_operatorPrivateKey);
        allocationManager.modifyAllocations(_operator, allocParams);
        Logging.logStep(
            string.concat("Allocated full magnitude for operator: ", vm.toString(_operator))
        );
    }
}
