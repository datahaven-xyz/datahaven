// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";
import {IRewardsCoordinator} from
    "eigenlayer-contracts/src/contracts/interfaces/IRewardsCoordinator.sol";
import {
    IAllocationManagerErrors,
    IAllocationManager,
    IAllocationManagerTypes
} from "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";

import {MockAVSDeployer} from "./utils/MockAVSDeployer.sol";
import {IServiceManager} from "../src/interfaces/IServiceManager.sol";
import {ISlasher, ISlasherErrors, ISlasherEvents} from "../src/interfaces/ISlasher.sol";
import {
    IVetoableSlasher,
    IVetoableSlasherTypes,
    IVetoableSlasherErrors,
    IVetoableSlasherEvents
} from "../src/interfaces/IVetoableSlasher.sol";
import {SlasherBase} from "../src/middleware/SlasherBase.sol";
import {VetoableSlasher} from "../src/middleware/VetoableSlasher.sol";

contract VetoableSlasherTest is MockAVSDeployer {
    address public nonServiceManagerRole;
    address public vetoCommittee;
    address public nonVetoCommittee;

    // Events for testing
    event SlashingRequested(
        uint256 indexed requestId,
        address indexed operator,
        uint32 indexed operatorSetId,
        uint256[] wadsToSlash,
        string description
    );

    event SlashingRequestCancelled(
        address indexed operator, uint32 operatorSetId, uint256[] wadsToSlash, string description
    );

    event SlashingRequestFulfilled(
        address indexed operator, uint32 operatorSetId, uint256[] wadsToSlash, string description
    );

    function setUp() public virtual {
        _deployMockEigenLayerAndAVS();
        _setUpDefaultStrategiesAndMultipliers();

        // Set up roles for testing
        nonServiceManagerRole = address(0x5678);
        vetoCommittee = address(0xabcd);
        nonVetoCommittee = address(0xdcba);

        // Deploy the VetoableSlasher contract
        vetoableSlasher =
            new VetoableSlasher(allocationManager, serviceManager, vetoCommittee, vetoWindowBlocks);
    }

    // Test constructor initializes state correctly
    function test_constructor() public view {
        assertEq(
            address(vetoableSlasher.allocationManager()),
            address(allocationManager),
            "AllocationManager address mismatch"
        );
        assertEq(
            address(vetoableSlasher.serviceManager()),
            address(serviceManager),
            "ServiceManager address mismatch"
        );
        assertEq(vetoableSlasher.vetoCommittee(), vetoCommittee, "Veto committee address mismatch");
        assertEq(
            vetoableSlasher.vetoWindowBlocks(), vetoWindowBlocks, "Veto window blocks mismatch"
        );
        assertEq(vetoableSlasher.nextRequestId(), 0, "NextRequestId should be initialized to 0");
    }

    // Test queueSlashingRequest reverts when called by non-ServiceManager
    function test_queueSlashingRequest_nonServiceManager() public {
        IAllocationManagerTypes.SlashingParams memory params;

        vm.prank(nonServiceManagerRole);
        vm.expectRevert(abi.encodeWithSelector(ISlasherErrors.OnlySlasher.selector));
        vetoableSlasher.queueSlashingRequest(params);
    }

    // Test queueSlashingRequest succeeds when called by ServiceManager
    function test_queueSlashingRequest_serviceManager() public {
        // Setup mock params
        address operator = address(0x1111);
        uint32 operatorSetId = 1;
        IStrategy[] memory strategies = new IStrategy[](1);
        strategies[0] = strategyMock1;
        uint256[] memory wadsToSlash = new uint256[](1);
        wadsToSlash[0] = 1e16; // 1% of the operator's stake
        string memory description = "Test slashing";

        IAllocationManagerTypes.SlashingParams memory params = IAllocationManagerTypes
            .SlashingParams({
            operator: operator,
            operatorSetId: operatorSetId,
            strategies: strategies,
            wadsToSlash: wadsToSlash,
            description: description
        });

        uint256 requestId = 0; // First request

        vm.prank(address(serviceManager));
        vm.expectEmit(true, true, true, true);
        emit IVetoableSlasherEvents.SlashingRequested(
            requestId, operator, operatorSetId, wadsToSlash, description
        );
        vetoableSlasher.queueSlashingRequest(params);

        // Verify request is stored correctly
        (
            IAllocationManagerTypes.SlashingParams memory storedParams,
            uint256 requestBlock,
            bool isPending
        ) = getSlashingRequest(requestId);

        assertEq(storedParams.operator, operator, "Operator mismatch");
        assertEq(storedParams.operatorSetId, operatorSetId, "OperatorSetId mismatch");
        assertEq(storedParams.wadsToSlash[0], wadsToSlash[0], "WadsToSlash mismatch");
        assertEq(storedParams.description, description, "Description mismatch");
        assertEq(requestBlock, block.number, "Request block mismatch");
        assertEq(isPending, true, "Status mismatch");

        // Verify nextRequestId is incremented
        assertEq(vetoableSlasher.nextRequestId(), 1, "NextRequestId should be incremented");
    }

    // Test cancelSlashingRequest reverts when called by non-veto committee
    function test_cancelSlashingRequest_nonVetoCommittee() public {
        // First create a request
        _createSlashingRequest();

        vm.prank(nonVetoCommittee);
        vm.expectRevert(abi.encodeWithSelector(IVetoableSlasherErrors.OnlyVetoCommittee.selector));
        vetoableSlasher.cancelSlashingRequest(0);
    }

    // Test cancelSlashingRequest succeeds when called by veto committee within veto period
    function test_cancelSlashingRequest_withinVetoPeriod() public {
        // First create a request
        uint256 requestId = _createSlashingRequest();
        (IAllocationManagerTypes.SlashingParams memory params,,) = getSlashingRequest(requestId);

        vm.prank(vetoCommittee);
        vm.expectEmit(true, false, false, false);
        emit IVetoableSlasherEvents.SlashingRequestCancelled(
            params.operator, params.operatorSetId, params.wadsToSlash, params.description
        );
        vetoableSlasher.cancelSlashingRequest(requestId);

        // Verify request status is updated
        (,, bool isPending) = getSlashingRequest(requestId);
        assertEq(isPending, false, "Status should be Cancelled");
    }

    // Test cancelSlashingRequest reverts when veto period has passed
    function test_cancelSlashingRequest_afterVetoPeriod() public {
        // First create a request
        uint256 requestId = _createSlashingRequest();

        // Fast forward past veto period
        vm.roll(block.number + vetoWindowBlocks + 1);

        vm.prank(vetoCommittee);
        vm.expectRevert(abi.encodeWithSelector(IVetoableSlasherErrors.VetoPeriodPassed.selector));
        vetoableSlasher.cancelSlashingRequest(requestId);
    }

    // Test cancelSlashingRequest reverts when request is not in Requested state
    function test_cancelSlashingRequest_notRequested() public {
        // First create a request
        uint256 requestId = _createSlashingRequest();

        // Cancel it once
        vm.prank(vetoCommittee);
        vetoableSlasher.cancelSlashingRequest(requestId);

        // Try to cancel it again
        vm.prank(vetoCommittee);
        vm.expectRevert(
            abi.encodeWithSelector(IVetoableSlasherErrors.SlashingRequestNotRequested.selector)
        );
        vetoableSlasher.cancelSlashingRequest(requestId);
    }

    // Test fulfillSlashingRequest reverts before veto period has passed
    function test_fulfillSlashingRequest_beforeVetoPeriod() public {
        // First create a request
        uint256 requestId = _createSlashingRequest();

        vm.prank(address(serviceManager));
        vm.expectRevert(abi.encodeWithSelector(IVetoableSlasherErrors.VetoPeriodNotPassed.selector));
        vetoableSlasher.fulfillSlashingRequest(requestId);
    }

    // Test fulfillSlashingRequest reverts when request is cancelled
    function test_fulfillSlashingRequest_cancelled() public {
        // First create a request
        uint256 requestId = _createSlashingRequest();

        // Cancel it
        vm.prank(vetoCommittee);
        vetoableSlasher.cancelSlashingRequest(requestId);

        // Fast forward past veto period
        vm.roll(block.number + vetoWindowBlocks + 1);

        vm.prank(address(serviceManager));
        vm.expectRevert(
            abi.encodeWithSelector(IVetoableSlasherErrors.SlashingRequestIsCancelled.selector)
        );
        vetoableSlasher.fulfillSlashingRequest(requestId);
    }

    // Test fulfillSlashingRequest succeeds after veto period has passed
    function test_fulfillSlashingRequest_afterVetoPeriod() public {
        // First create a request
        uint256 requestId = _createSlashingRequest();
        address operator = address(0x1111);
        uint32 operatorSetId = 1;

        // Setup the mock for slashing
        IAllocationManagerTypes.SlashingParams memory params;
        (params,,) = getSlashingRequest(requestId);

        vm.mockCall(
            address(allocationManager),
            abi.encodeWithSelector(
                IAllocationManager.slashOperator.selector, serviceManager.avs(), params
            ),
            abi.encode()
        );

        // Fast forward past veto period
        vm.roll(block.number + vetoWindowBlocks + 1);

        vm.prank(address(serviceManager));
        vm.expectEmit(true, true, true, true);
        emit ISlasherEvents.OperatorSlashed(
            requestId, operator, operatorSetId, params.wadsToSlash, params.description
        );
        vm.expectEmit(true, true, true, true);
        emit SlashingRequestFulfilled(
            operator, operatorSetId, params.wadsToSlash, params.description
        );
        vetoableSlasher.fulfillSlashingRequest(requestId);

        // Verify request is deleted from storage
        (
            IAllocationManagerTypes.SlashingParams memory emptyParams,
            uint256 requestBlock,
            bool isPending
        ) = getSlashingRequest(requestId);
        assertEq(
            emptyParams.operator, address(0), "Request should be deleted - operator not zeroed"
        );
        assertEq(requestBlock, 0, "Request should be deleted - requestBlock not zeroed");
        assertEq(isPending, false, "Request should be deleted - isPending not false");
    }

    // Test cancelSlashingRequest properly deletes the request from storage
    function test_cancelSlashingRequest_deletesFromStorage() public {
        // First create a request
        uint256 requestId = _createSlashingRequest();
        (IAllocationManagerTypes.SlashingParams memory params,,) = getSlashingRequest(requestId);

        vm.prank(vetoCommittee);
        vm.expectEmit(true, true, true, true);
        emit SlashingRequestCancelled(
            params.operator, params.operatorSetId, params.wadsToSlash, params.description
        );
        vetoableSlasher.cancelSlashingRequest(requestId);

        // Verify request is deleted from storage
        (
            IAllocationManagerTypes.SlashingParams memory emptyParams,
            uint256 requestBlock,
            bool isPending
        ) = getSlashingRequest(requestId);
        assertEq(
            emptyParams.operator, address(0), "Request should be deleted - operator not zeroed"
        );
        assertEq(requestBlock, 0, "Request should be deleted - requestBlock not zeroed");
        assertEq(isPending, false, "Request should be deleted - isPending not false");
    }

    // Test multiple requests flow
    function test_multipleRequests() public {
        // Create first request
        uint256 requestId1 = _createSlashingRequest();

        // Create second request with different parameters
        address operator2 = address(0x2222);
        uint32 operatorSetId2 = 2;
        IStrategy[] memory strategies2 = new IStrategy[](1);
        strategies2[0] = strategyMock2;
        uint256[] memory wadsToSlash2 = new uint256[](1);
        wadsToSlash2[0] = 2e16; // 2% of the operator's stake
        string memory description2 = "Second slashing";

        IAllocationManagerTypes.SlashingParams memory params2 = IAllocationManagerTypes
            .SlashingParams({
            operator: operator2,
            operatorSetId: operatorSetId2,
            strategies: strategies2,
            wadsToSlash: wadsToSlash2,
            description: description2
        });

        uint256 requestId2 = 1; // Second request

        vm.prank(address(serviceManager));
        vetoableSlasher.queueSlashingRequest(params2);

        // Cancel the first request
        vm.prank(vetoCommittee);
        vetoableSlasher.cancelSlashingRequest(requestId1);

        // Setup the mock for slashing the second request
        vm.mockCall(
            address(allocationManager),
            abi.encodeWithSelector(
                IAllocationManager.slashOperator.selector, serviceManager.avs(), params2
            ),
            abi.encode()
        );

        // Fast forward past veto period
        vm.roll(block.number + vetoWindowBlocks + 1);

        // Try to fulfill the first (cancelled) request - should revert
        vm.prank(address(serviceManager));
        vm.expectRevert(
            abi.encodeWithSelector(IVetoableSlasherErrors.SlashingRequestIsCancelled.selector)
        );
        vetoableSlasher.fulfillSlashingRequest(requestId1);

        // Fulfill the second request - should succeed
        vm.prank(address(serviceManager));
        vetoableSlasher.fulfillSlashingRequest(requestId2);

        // Verify states
        (,, bool isPending1) = getSlashingRequest(requestId1);
        (,, bool isPending2) = getSlashingRequest(requestId2);

        assertEq(isPending1, false, "Request 1 status should be Cancelled");
        assertEq(isPending2, false, "Request 2 status should be Completed");
    }

    // Helper function to create a standard slashing request
    function _createSlashingRequest() internal returns (uint256) {
        address operator = address(0x1111);
        uint32 operatorSetId = 1;
        IStrategy[] memory strategies = new IStrategy[](1);
        strategies[0] = strategyMock1;
        uint256[] memory wadsToSlash = new uint256[](1);
        wadsToSlash[0] = 1e16; // 1% of the operator's stake
        string memory description = "Test slashing";

        IAllocationManagerTypes.SlashingParams memory params = IAllocationManagerTypes
            .SlashingParams({
            operator: operator,
            operatorSetId: operatorSetId,
            strategies: strategies,
            wadsToSlash: wadsToSlash,
            description: description
        });

        uint256 requestId = vetoableSlasher.nextRequestId();

        vm.prank(address(serviceManager));
        vetoableSlasher.queueSlashingRequest(params);

        return requestId;
    }

    // Helper function to extract SlashingRequest from storage
    function getSlashingRequest(
        uint256 requestId
    )
        internal
        view
        returns (
            IAllocationManagerTypes.SlashingParams memory params,
            uint256 requestBlock,
            bool isPending
        )
    {
        (params, requestBlock, isPending) = vetoableSlasher.slashingRequests(requestId);
    }
}
