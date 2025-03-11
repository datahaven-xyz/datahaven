// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";
import {IRewardsCoordinator} from "eigenlayer-contracts/src/contracts/interfaces/IRewardsCoordinator.sol";
import {StrategyBase} from "eigenlayer-contracts/src/contracts/strategies/StrategyBase.sol";
import {IAllocationManagerErrors, IAllocationManager} from "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";

import {ServiceManagerMock} from "./mocks/ServiceManagerMock.sol";
import {MockAVSDeployer} from "./utils/MockAVSDeployer.sol";
import {IServiceManager} from "../src/interfaces/IServiceManager.sol";
import {IServiceManagerUI} from "../src/interfaces/IServiceManagerUI.sol";
import {ServiceManagerBase} from "../src/middleware/ServiceManagerBase.sol";

contract ServiceManagerBaseTest is MockAVSDeployer {
    function setUp() public virtual {
        _deployMockEigenLayerAndAVS();
        _setUpDefaultStrategiesAndMultipliers();
    }

    function beforeTestSetup(
        bytes4 testSelector
    ) public pure returns (bytes[] memory beforeTestCalldata) {}

    function test_registerAVS() public {
        vm.prank(avsOwner);
        IServiceManagerUI(address(serviceManager)).updateAVSMetadataURI(
            "https://example.com"
        );
    }

    function test_registerAVSRevertsIfNotAVSOwner() public {
        vm.prank(rewardsUpdater);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        IServiceManagerUI(address(serviceManager)).updateAVSMetadataURI(
            "https://example.com"
        );
    }

    function test_createOperatorSetsRevertsIfNoMetadataExists() public {
        vm.prank(avsOwner);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAllocationManagerErrors.NonexistentAVSMetadata.selector
            )
        );

        IAllocationManager.CreateSetParams[]
            memory emptyParams = new IAllocationManager.CreateSetParams[](0);
        ServiceManagerBase(address(serviceManager)).createOperatorSets(
            emptyParams
        );
    }
}
