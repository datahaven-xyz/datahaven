// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.3;

interface IBloatedContract {
    function doSomething() external;
}

interface ILooper {
    function incrementalLoop(uint256 n) external;
}

contract SubCallOOG {
    event SubCallSucceed();
    event SubCallFail();

    function subCallPov(address[] memory addresses) public {
        for (uint256 i = 0; i < addresses.length; i++) {
            try IBloatedContract(addresses[i]).doSomething() {
                emit SubCallSucceed();
            } catch (bytes memory) {
                emit SubCallFail();
            }
        }
    }

    function subCallLooper(address target, uint256 n) public {
        try ILooper(target).incrementalLoop(n) {
            emit SubCallSucceed();
        } catch (bytes memory) {
            emit SubCallFail();
        }
    }
}
