// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";
import {IRewardsCoordinator} from "eigenlayer-contracts/src/contracts/interfaces/IRewardsCoordinator.sol";
import {IAllocationManagerErrors, IAllocationManager, IAllocationManagerTypes} from "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";

import {MockAVSDeployer} from "./utils/MockAVSDeployer.sol";
import {IServiceManager} from "../src/interfaces/IServiceManager.sol";
import {ISlasher, ISlasherErrors, ISlasherEvents} from "../src/interfaces/ISlasher.sol";
import {SlasherBase} from "../src/middleware/SlasherBase.sol";
import {SlasherMock} from "./mocks/SlasherBaseMock.sol";

contract SlasherBaseTest is MockAVSDeployer {
    SlasherMock public slasherContract;
    address public nonServiceManagerRole;

    function setUp() public virtual {
        _deployMockEigenLayerAndAVS();
        _setUpDefaultStrategiesAndMultipliers();

        // Set up roles for testing
        nonServiceManagerRole = address(0x5678);

        // Deploy the SlasherMock contract, to specifically test the SlasherBase contract
        slasherContract = new SlasherMock(allocationManager, serviceManager);
    }

    // Test constructor initializes state correctly
    function test_constructor() public view {
        assertEq(
            address(slasherContract.allocationManager()),
            address(allocationManager),
            "AllocationManager address mismatch"
        );
        assertEq(
            address(slasherContract.serviceManager()),
            address(serviceManager),
            "ServiceManager address mismatch"
        );
        assertEq(
            slasherContract.nextRequestId(),
            0,
            "NextRequestId should be initialized to 0"
        );
    }

    // Test that a function with the onlySlasher modifier reverts when called by non-ServiceManager
    function test_onlySlasherModifier_nonSlasher() public {
        vm.prank(nonServiceManagerRole);
        vm.expectRevert(
            abi.encodeWithSelector(ISlasherErrors.OnlySlasher.selector)
        );
        slasherContract.restrictedFunction();
    }

    // Test that a function with the onlySlasher modifier allows access when called by ServiceManager
    function test_onlySlasherModifier_slasher() public {
        vm.prank(address(serviceManager));
        // This should not revert
        slasherContract.restrictedFunction();
    }

    // Test that fulfilSlashingRequest can be called by anyone now that the onlySlasher modifier has been removed
    function test_fulfilSlashingRequest_anyoneCanCall() public {
        // Setup mock params
        address operator = address(0xabcd);
        uint32 operatorSetId = 1;
        IStrategy[] memory strategies = new IStrategy[](1);
        strategies[0] = strategyMock1;
        uint256[] memory wadsToSlash = new uint256[](1);
        wadsToSlash[0] = 1e16;
        string memory description = "Test slashing by non-ServiceManager";

        IAllocationManagerTypes.SlashingParams
            memory params = IAllocationManagerTypes.SlashingParams({
                operator: operator,
                operatorSetId: operatorSetId,
                strategies: strategies,
                wadsToSlash: wadsToSlash,
                description: description
            });

        // Mock the allocationManager.slashOperator call
        vm.mockCall(
            address(allocationManager),
            abi.encodeWithSelector(
                IAllocationManager.slashOperator.selector,
                serviceManager.avs(),
                params
            ),
            abi.encode()
        );

        uint256 requestId = 5;

        // A random address should be able to call fulfilSlashingRequest
        vm.prank(nonServiceManagerRole);
        vm.expectEmit(true, true, true, true);
        emit ISlasherEvents.OperatorSlashed(
            requestId,
            operator,
            operatorSetId,
            wadsToSlash,
            description
        );
        slasherContract.fulfilSlashingRequest(requestId, params);
    }

    // Test the _checkSlasher internal function
    function test_checkSlasher() public {
        // Should succeed for ServiceManager
        vm.prank(address(serviceManager));
        slasherContract.checkSlasher(address(serviceManager));

        // Should revert for non-ServiceManager
        vm.expectRevert(
            abi.encodeWithSelector(ISlasherErrors.OnlySlasher.selector)
        );
        slasherContract.checkSlasher(nonServiceManagerRole);
    }

    // Test the _fulfilSlashingRequest internal function with different parameters
    function test_fulfilSlashingRequest_withMultipleStrategies() public {
        // Setup mock params with multiple strategies
        address operator = address(0xabcd);
        uint32 operatorSetId = 1;
        IStrategy[] memory strategies = new IStrategy[](2);
        strategies[0] = strategyMock1;
        strategies[1] = strategyMock2;
        uint256[] memory wadsToSlash = new uint256[](2);
        wadsToSlash[0] = 1e16; // 1% of the operator's stake
        wadsToSlash[1] = 2e16; // 2% of the operator's stake
        string memory description = "Multiple strategy slashing";

        IAllocationManagerTypes.SlashingParams
            memory params = IAllocationManagerTypes.SlashingParams({
                operator: operator,
                operatorSetId: operatorSetId,
                strategies: strategies,
                wadsToSlash: wadsToSlash,
                description: description
            });

        // Mock the allocationManager.slashOperator call
        vm.mockCall(
            address(allocationManager),
            abi.encodeWithSelector(
                IAllocationManager.slashOperator.selector,
                serviceManager.avs(),
                params
            ),
            abi.encode()
        );

        uint256 requestId = 2;

        // ServiceManager should be able to call fulfilSlashingRequest
        vm.prank(address(serviceManager));
        vm.expectEmit(true, true, true, true);
        emit ISlasherEvents.OperatorSlashed(
            requestId,
            operator,
            operatorSetId,
            wadsToSlash,
            description
        );
        slasherContract.fulfilSlashingRequest(requestId, params);
    }

    // Test fulfilSlashingRequest with zero wads to slash
    function test_fulfilSlashingRequest_zeroWadsToSlash() public {
        // Setup mock params with zero wads
        address operator = address(0xabcd);
        uint32 operatorSetId = 1;
        IStrategy[] memory strategies = new IStrategy[](1);
        strategies[0] = strategyMock1;
        uint256[] memory wadsToSlash = new uint256[](1);
        wadsToSlash[0] = 0; // Zero tokens
        string memory description = "Zero wad slashing";

        IAllocationManagerTypes.SlashingParams
            memory params = IAllocationManagerTypes.SlashingParams({
                operator: operator,
                operatorSetId: operatorSetId,
                strategies: strategies,
                wadsToSlash: wadsToSlash,
                description: description
            });

        // Mock the allocationManager.slashOperator call
        vm.mockCall(
            address(allocationManager),
            abi.encodeWithSelector(
                IAllocationManager.slashOperator.selector,
                serviceManager.avs(),
                params
            ),
            abi.encode()
        );

        uint256 requestId = 3;

        // ServiceManager should be able to call fulfilSlashingRequest
        vm.prank(address(serviceManager));
        vm.expectEmit(true, true, true, true);
        emit ISlasherEvents.OperatorSlashed(
            requestId,
            operator,
            operatorSetId,
            wadsToSlash,
            description
        );
        slasherContract.fulfilSlashingRequest(requestId, params);
    }

    // Test error handling when allocationManager.slashOperator reverts
    function test_fulfilSlashingRequest_allocationManagerReverts() public {
        // Setup mock params
        address operator = address(0xabcd);
        uint32 operatorSetId = 1;
        IStrategy[] memory strategies = new IStrategy[](1);
        strategies[0] = strategyMock1;
        uint256[] memory wadsToSlash = new uint256[](1);
        wadsToSlash[0] = 1e16; // 1% of the operator's stake
        string memory description = "Revert test";

        IAllocationManagerTypes.SlashingParams
            memory params = IAllocationManagerTypes.SlashingParams({
                operator: operator,
                operatorSetId: operatorSetId,
                strategies: strategies,
                wadsToSlash: wadsToSlash,
                description: description
            });

        // Mock the allocationManager.slashOperator call to revert
        vm.mockCallRevert(
            address(allocationManager),
            abi.encodeWithSelector(
                IAllocationManager.slashOperator.selector,
                serviceManager.avs(),
                params
            ),
            abi.encodeWithSignature("SomeError()")
        );

        uint256 requestId = 4;

        // ServiceManager should be able to call fulfilSlashingRequest
        vm.prank(address(serviceManager));
        vm.expectRevert(abi.encodeWithSignature("SomeError()"));
        slasherContract.fulfilSlashingRequest(requestId, params);
    }
}
