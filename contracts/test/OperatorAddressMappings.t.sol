// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {AVSDeployer} from "./utils/AVSDeployer.sol";
import {DataHavenServiceManager} from "../src/DataHavenServiceManager.sol";
import {
    IAllocationManagerTypes
} from "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {Test} from "forge-std/Test.sol";

contract OperatorAddressMappingsTest is AVSDeployer {
    address public snowbridgeAgent = address(uint160(uint256(keccak256("snowbridgeAgent"))));

    address internal operator1 = address(uint160(uint256(keccak256("operator1"))));
    address internal operator2 = address(uint160(uint256(keccak256("operator2"))));

    function setUp() public virtual {
        _deployMockEigenLayerAndAVS();

        // Configure the rewards initiator (not strictly needed for these tests,
        // but keeps setup consistent with other suites).
        vm.prank(avsOwner);
        serviceManager.setRewardsInitiator(snowbridgeAgent);
    }

    function _registerOperator(
        address ethOperator,
        address solochainOperator
    ) internal {
        vm.prank(avsOwner);
        serviceManager.addValidatorToAllowlist(ethOperator);

        vm.prank(ethOperator);
        delegationManager.registerAsOperator(address(0), 0, "");

        uint32[] memory operatorSetIds = new uint32[](1);
        operatorSetIds[0] = serviceManager.VALIDATORS_SET_ID();
        IAllocationManagerTypes.RegisterParams memory registerParams =
            IAllocationManagerTypes.RegisterParams({
                avs: address(serviceManager),
                operatorSetIds: operatorSetIds,
                data: abi.encodePacked(solochainOperator)
            });

        vm.prank(ethOperator);
        allocationManager.registerForOperatorSets(ethOperator, registerParams);
    }

    function test_registerOperator_revertsIfSolochainAlreadyAssignedToDifferentOperator() public {
        address sharedSolochain = address(0xBEEF);

        _registerOperator(operator1, sharedSolochain);

        // operator2 cannot claim the same solochain address
        vm.prank(avsOwner);
        serviceManager.addValidatorToAllowlist(operator2);
        vm.prank(operator2);
        delegationManager.registerAsOperator(address(0), 0, "");

        uint32[] memory operatorSetIds = new uint32[](1);
        operatorSetIds[0] = serviceManager.VALIDATORS_SET_ID();
        IAllocationManagerTypes.RegisterParams memory registerParams =
            IAllocationManagerTypes.RegisterParams({
                avs: address(serviceManager),
                operatorSetIds: operatorSetIds,
                data: abi.encodePacked(sharedSolochain)
            });

        vm.prank(operator2);
        vm.expectRevert(abi.encodeWithSignature("SolochainAddressAlreadyAssigned()"));
        allocationManager.registerForOperatorSets(operator2, registerParams);
    }

    function test_updateSolochainAddressForValidator_revertsIfAlreadyAssignedToDifferentOperator()
        public
    {
        address solo1 = address(0xBEEF);
        address solo2 = address(0xCAFE);

        _registerOperator(operator1, solo1);
        _registerOperator(operator2, solo2);

        // operator2 cannot update to operator1's solochain address
        vm.prank(operator2);
        vm.expectRevert(abi.encodeWithSignature("SolochainAddressAlreadyAssigned()"));
        serviceManager.updateSolochainAddressForValidator(solo1);
    }

    function test_updateSolochainAddressForValidator_clearsOldReverseMapping() public {
        address soloOld = address(0xBEEF);
        address soloNew = address(0xCAFE);

        _registerOperator(operator1, soloOld);

        assertEq(
            serviceManager.validatorEthAddressToSolochainAddress(operator1),
            soloOld,
            "forward mapping should be set"
        );
        assertEq(
            serviceManager.validatorSolochainAddressToEthAddress(soloOld),
            operator1,
            "reverse mapping should be set"
        );

        vm.prank(operator1);
        serviceManager.updateSolochainAddressForValidator(soloNew);

        assertEq(
            serviceManager.validatorEthAddressToSolochainAddress(operator1),
            soloNew,
            "forward mapping should update"
        );
        assertEq(
            serviceManager.validatorSolochainAddressToEthAddress(soloNew),
            operator1,
            "reverse mapping should update"
        );
        assertEq(
            serviceManager.validatorSolochainAddressToEthAddress(soloOld),
            address(0),
            "old reverse mapping should be cleared"
        );
    }

    function test_registerOperator_replacesSolochainAndClearsOldReverseMapping() public {
        address soloOld = address(0xBEEF);
        address soloNew = address(0xCAFE);

        _registerOperator(operator1, soloOld);

        // simulate allocationManager registering operator1 again with a new solochain address
        uint32[] memory operatorSetIds = new uint32[](1);
        operatorSetIds[0] = serviceManager.VALIDATORS_SET_ID();

        vm.prank(address(allocationManager));
        serviceManager.registerOperator(
            operator1, address(serviceManager), operatorSetIds, abi.encodePacked(soloNew)
        );

        assertEq(
            serviceManager.validatorEthAddressToSolochainAddress(operator1),
            soloNew,
            "forward mapping should update"
        );
        assertEq(
            serviceManager.validatorSolochainAddressToEthAddress(soloNew),
            operator1,
            "reverse mapping should update"
        );
        assertEq(
            serviceManager.validatorSolochainAddressToEthAddress(soloOld),
            address(0),
            "old reverse mapping should be cleared"
        );
    }
}

