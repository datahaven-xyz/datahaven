// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.3;

contract HasherChecker {
    uint256 public lastResult;

    function ripemd160Check() public pure {
        require(
            ripemd160(bytes("Hello World!")) ==
                hex"8476ee4631b9b30ac2754b0ee0c47e161d3f724c"
        );
    }

    function bn128AdditionCheck() public {
        bool success;
        uint256[4] memory input = [
            0x2243525c5efd4b9c3d3c45ac0ca3fe4dd85e830a4ce6b65fa1eeaee202839703,
            0x301d1d33be6da8e509df21cc35964723180eed7532537db9ae5e7d48f195c915,
            0x18b18acfb4c2c30276db5411368e7185b311dd124691610c5d3b74034e093dc9,
            0x063c909c4720840cb5134cb9f59fa749755796819658d32efc0d288198f37266
        ];
        uint256[2] memory result;

        assembly {
            // 0x06     id of the bn256Add precompile
            // 0        number of ether to transfer
            // 128      size of call parameters, i.e. 128 bytes total
            // 64       size of return value, i.e. 64 bytes / 512 bit for a BN256 curve point
            success := call(not(0), 0x06, 0, input, 128, result, 64)
        }
        require(success, "elliptic curve addition failed");
        require(
            result[0] ==
                0x2bd3e6d0f3b142924f5ca7b49ce5b9d54c4703d7ae5648e61d02268b1a0a9fb7,
            "failed"
        );
        require(
            result[1] ==
                0x21611ce0a6af85915e2f1d70300909ce2e49dfad4a4619c8390cae66cefdb204,
            "failed"
        );
    }

    function bn128MultiplyCheck() public {
        bool success;
        uint256[3] memory input = [
            0x1a87b0584ce92f4593d161480614f2989035225609f08058ccfa3d0f940febe3,
            0x1a2f3c951f6dadcc7ee9007dff81504b0fcd6d7cf59996efdc33d92bf7f9f8f6,
            0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000000
        ];
        uint256[2] memory result;

        assembly {
            // 0x07     id of the bn256Mul precompile
            // 0        number of ether to transfer
            // 96       size of call parameters, i.e. 128 bytes total
            // 64       size of return value, i.e. 64 bytes / 512 bit for a BN256 curve point
            success := call(not(0), 0x07, 0, input, 96, result, 64)
        }
        require(success, "elliptic curve addition failed");
        require(
            result[0] ==
                0x1a87b0584ce92f4593d161480614f2989035225609f08058ccfa3d0f940febe3,
            "failed"
        );
        require(
            result[1] ==
                0x163511ddc1c3f25d396745388200081287b3fd1472d8339d5fecb2eae0830451,
            "failed"
        );
    }

    function bn128PairingCheck() public {
        uint256[12] memory input = [
            0x2eca0c7238bf16e83e7a1e6c5d49540685ff51380f309842a98561558019fc02,
            0x03d3260361bb8451de5ff5ecd17f010ff22f5c31cdf184e9020b06fa5997db84,
            0x1213d2149b006137fcfb23036606f848d638d576a120ca981b5b1a5f9300b3ee,
            0x2276cf730cf493cd95d64677bbb75fc42db72513a4c1e387b476d056f80aa75f,
            0x21ee6226d31426322afcda621464d0611d226783262e21bb3bc86b537e986237,
            0x096df1f82dff337dd5972e32a8ad43e28a78a96a823ef1cd4debe12b6552ea5f,
            0x06967a1237ebfeca9aaae0d6d0bab8e28c198c5a339ef8a2407e31cdac516db9,
            0x22160fa257a5fd5b280642ff47b65eca77e626cb685c84fa6d3b6882a283ddd1,
            0x198e9393920d483a7260bfb731fb5d25f1aa493335a9e71297e485b7aef312c2,
            0x1800deef121f1e76426a00665e5c4479674322d4f75edadd46debd5cd992f6ed,
            0x090689d0585ff075ec9e99ad690c3395bc4b313370b38ef355acdadcd122975b,
            0x12c85ea5db8c6deb4aab71808dcb408fe3d1e7690c43d37b4ce6cc0166fa7daa
        ];
        uint256[1] memory result;
        bool success;
        assembly {
            // 0x08     id of the bn256CheckPairing precompile
            // 0        number of ether to transfer
            // 0        since we have an array of fixed length, our input starts in 0
            // 384      size of call parameters, i.e. 12*256 bits == 384 bytes
            // 32       size of result (one 32 byte boolean!)
            success := call(sub(gas(), 2000), 0x08, 0, input, 384, result, 32)
        }
        require(success, "elliptic curve pairing failed");
        require(result[0] == 1, "failed");
    }

    function modExpWrapper(
        uint256 _b,
        uint256 _e,
        uint256 _m
    ) public returns (uint256 result) {
        assembly {
            // Free memory pointer
            let pointer := mload(0x40)
            // Define length of base, exponent and modulus. 0x20 == 32 bytes
            mstore(pointer, 0x20)
            mstore(add(pointer, 0x20), 0x20)
            mstore(add(pointer, 0x40), 0x20)
            // Define variables base, exponent and modulus
            mstore(add(pointer, 0x60), _b)
            mstore(add(pointer, 0x80), _e)

            mstore(add(pointer, 0xa0), _m)
            // Store the result
            let value := mload(0xc0)
            // Call the precompiled contract 0x05 = bigModExp
            if iszero(call(not(0), 0x05, 0, pointer, 0xc0, value, 0x20)) {
                revert(0, 0)
            }
            result := mload(value)
        }
    }

    function modExpVerify(
        uint256 _base,
        uint256 _exponent,
        uint256 _modulus
    ) public {
        lastResult = modExpWrapper(_base, _exponent, _modulus);
    }

    function getResult() public view returns (uint256) {
        return lastResult;
    }

    function modExpChecker() public {
        require(modExpWrapper(3, 5, 7) == 5);
        require(modExpWrapper(5, 7, 11) == 3);
    }

    function blake2Wrapper(
        uint32 rounds,
        bytes32[2] memory h,
        bytes32[4] memory m,
        bytes8[2] memory t,
        bool f
    ) public view returns (bytes32[2] memory) {
        bytes32[2] memory output;

        bytes memory args = abi.encodePacked(
            rounds,
            h[0],
            h[1],
            m[0],
            m[1],
            m[2],
            m[3],
            t[0],
            t[1],
            f
        );

        assembly {
            if iszero(
                staticcall(not(0), 0x09, add(args, 32), 0xd5, output, 0x40)
            ) {
                revert(0, 0)
            }
        }

        return output;
    }

    function blake2Check() public {
        uint32 rounds = 12;

        bytes32[2] memory h;
        h[
            0
        ] = hex"48c9bdf267e6096a3ba7ca8485ae67bb2bf894fe72f36e3cf1361d5f3af54fa5";
        h[
            1
        ] = hex"d182e6ad7f520e511f6c3e2b8c68059b6bbd41fbabd9831f79217e1319cde05b";

        bytes32[4] memory m;
        m[
            0
        ] = hex"6162630000000000000000000000000000000000000000000000000000000000";
        m[
            1
        ] = hex"0000000000000000000000000000000000000000000000000000000000000000";
        m[
            2
        ] = hex"0000000000000000000000000000000000000000000000000000000000000000";
        m[
            3
        ] = hex"0000000000000000000000000000000000000000000000000000000000000000";

        bytes8[2] memory t;
        t[0] = hex"03000000";
        t[1] = hex"00000000";

        bool f = true;

        // Expected output:
        // ba80a53f981c4d0d6a2797b69f12f6e94c212f14685ac4b74b12bb6fdbffa2d1
        // 7d87c5392aab792dc252d5de4533cc9518d38aa8dbf1925ab92386edd4009923

        bytes32[2] memory result = blake2Wrapper(rounds, h, m, t, f);
        require(
            result[0] ==
                0xba80a53f981c4d0d6a2797b69f12f6e94c212f14685ac4b74b12bb6fdbffa2d1,
            "failed"
        );
        require(
            result[1] ==
                0x7d87c5392aab792dc252d5de4533cc9518d38aa8dbf1925ab92386edd4009923,
            "failed"
        );
    }
}
