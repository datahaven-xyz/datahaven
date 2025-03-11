// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.27;

import {IPermissionController} from
    "eigenlayer-contracts/src/contracts/interfaces/IPermissionController.sol";

contract PermissionControllerIntermediate is IPermissionController {
    function addPendingAdmin(address account, address admin) external virtual {}

    function removePendingAdmin(address account, address admin) external virtual {}

    function acceptAdmin(
        address account
    ) external virtual {}

    function removeAdmin(address account, address admin) external virtual {}

    function setAppointee(
        address account,
        address appointee,
        address target,
        bytes4 selector
    ) external virtual {}

    function removeAppointee(
        address account,
        address appointee,
        address target,
        bytes4 selector
    ) external virtual {}

    function isAdmin(address account, address caller) external view virtual returns (bool) {}

    function isPendingAdmin(
        address account,
        address pendingAdmin
    ) external view virtual returns (bool) {}

    function getAdmins(
        address account
    ) external view virtual returns (address[] memory) {}

    function getPendingAdmins(
        address account
    ) external view virtual returns (address[] memory) {}

    function canCall(
        address account,
        address caller,
        address target,
        bytes4 selector
    ) external virtual returns (bool) {}

    function getAppointeePermissions(
        address account,
        address appointee
    ) external virtual returns (address[] memory, bytes4[] memory) {}

    function getAppointees(
        address account,
        address target,
        bytes4 selector
    ) external virtual returns (address[] memory) {}

    function version() external pure override returns (string memory) {
        return "mock";
    }
}

contract PermissionControllerMock is PermissionControllerIntermediate {
    mapping(address => mapping(address => mapping(address => mapping(bytes4 => bool)))) internal
        _canCall;

    function setCanCall(
        address account,
        address caller,
        address target,
        bytes4 selector
    ) external {
        _canCall[account][caller][target][selector] = true;
    }

    function canCall(
        address account,
        address caller,
        address target,
        bytes4 selector
    ) external view override returns (bool) {
        if (account == caller) return true;
        return _canCall[account][caller][target][selector];
    }
}
