// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
// Generated, do not edit!
// See ethereum client README.md for instructions to generate

use hex_literal::hex;
use snowbridge_beacon_primitives::{
    types::deneb, AncestryProof, BeaconHeader, ExecutionProof, VersionedExecutionPayloadHeader,
};
use snowbridge_verification_primitives::{EventFixture, EventProof, Log, Proof};
use sp_core::U256;
use sp_std::vec;

pub fn make_submit_delivery_receipt_message() -> EventFixture {
    EventFixture {
        event: EventProof {
            event_log: 	Log {
                address: hex!("b1185ede04202fe62d38f5db72f71e38ff3e8305").into(),
                topics: vec![
                    hex!("8856ab63954e6c2938803a4654fb704c8779757e7bfdbe94a578e341ec637a95").into(),
                    hex!("0000000000000000000000000000000000000000000000000000000000000000").into(),
                ],
                data: hex!("907b6ec7bf3f2496ef79238e0fb19e032bfe444c7ffe906bd340c6c4ffe8511f0000000000000000000000000000000000000000000000000000000000000001d43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d").into(),
            },
            proof: Proof {
                receipt_proof: (vec![
                    hex!("8a40611a32af2ad0ad63bf32e8c633ff209e6f701645b8f25e492327cd95d4e0").to_vec(),
                ], vec![
                    hex!("f9024e822080b9024802f9024401830d716eb9010000200000000000000000000000000000080000000000000000000000000000000000000000000004000000000000000000000000000000000000000000008000000000000000000801000000000000000000000000000000000000000000000000000000020000000008000000000800000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000800000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000020000000000200000000000000000000000000000000000000000000000000000000f90139f87a94b1185ede04202fe62d38f5db72f71e38ff3e8305f842a057f58171b8777633d03aff1e7408b96a3d910c93a7ce433a8cb7fb837dc306a6a09441dceeeffa7e032eedaccf9b7632e60e86711551a82ffbbb0dda8afd9e4ef7a0000000000000000000000000de45448ca2d57797c0bec0ee15a1e42334744219f8bb94b1185ede04202fe62d38f5db72f71e38ff3e8305f842a08856ab63954e6c2938803a4654fb704c8779757e7bfdbe94a578e341ec637a95a00000000000000000000000000000000000000000000000000000000000000000b860907b6ec7bf3f2496ef79238e0fb19e032bfe444c7ffe906bd340c6c4ffe8511f0000000000000000000000000000000000000000000000000000000000000001d43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d").to_vec(),
                ]),
                execution_proof: ExecutionProof {
                    header: BeaconHeader {
                        slot: 663,
                        proposer_index: 4,
                        parent_root: hex!("478651896411faa949cd0882bb6a82595b71d3eba74cbeb87b5eb8162c7e00f1").into(),
                        state_root: hex!("4191b7c2a622b8cfa31684e5e06de3b36834e403a6ded2acd32156a488f829b0").into(),
                        body_root: hex!("72765c81bbad6cd083314506936528719e03d33ee65927167a372febe1fbf734").into(),
                    },
                        ancestry_proof: Some(AncestryProof {
                        header_branch: vec![
                            hex!("478651896411faa949cd0882bb6a82595b71d3eba74cbeb87b5eb8162c7e00f1").into(),
                            hex!("87314a5200d3a22749bd98ba32af7d0546d25d47cf012dfcc85adc19ad7adfe3").into(),
                            hex!("e794355aa5b1743ea691e3f051f44a66956892621c0110a12980e66f70dc3d74").into(),
                            hex!("fe0a3f7035e5d4cc83412939c9d343caa34889bd9655a05e9cc53a09e3aa7e8c").into(),
                            hex!("0f472e1a66d039197fbe378845e848ec11d5bcde60ac650da812fa1f4461c603").into(),
                            hex!("018f388291fbd20c15691e4b118a17b870eec7beb837e91fcc839adcb5fb21fc").into(),
                            hex!("8a016b0d65b61e5026b9357df092bf82b52fa61af3e10d11ba7b24ae30b457ec").into(),
                            hex!("73af6cacce9735d5576d1defc7fc39061776004ac7d3aba3abf6dfad7b1a3a36").into(),
                            hex!("6116f4b671f0f26c224ab10c6c330d56c9b5e48fa6e2204035f333bc142f55d2").into(),
                            hex!("a08d24b9120c5faeb98654664c4a324aaa509031193dbd74930acf26285b26a6").into(),
                            hex!("ffff0ad7e659772f9534c195c815efc4014ef1e1daed4404c06385d11192e92b").into(),
                            hex!("6cf04127db05441cd833107a52be852868890e4317e6a02ab47683aa75964220").into(),
                            hex!("b7d05f875f140027ef5118a2247bbb84ce8f2f0f1123623085daf7960c329f5f").into(),
                        ],
                        finalized_block_root: hex!("d5793913dc57d9f5b9d50fb8c693504201d6926649834ac90337b673e66f98e0").into(),
                        }),
                    execution_header: VersionedExecutionPayloadHeader::Deneb(deneb::ExecutionPayloadHeader {
                        parent_hash: hex!("35f64f37bea4538092ba578f4851d52375f7f3b2a52c1cb16f22fe512aead95d").into(),
                        fee_recipient: hex!("0000000000000000000000000000000000000000").into(),
                        state_root: hex!("dfa305877e67ab0caa827b15d573b58dfe360fe8d484d37228f8ae55ccced61c").into(),
                        receipts_root: hex!("8a40611a32af2ad0ad63bf32e8c633ff209e6f701645b8f25e492327cd95d4e0").into(),
                        logs_bloom: hex!("00200000000000000000000000000000080000000000000000000000000000000000000000000004000000000000000000000000000000000000000000008000000000000000000801000000000000000000000000000000000000000000000000000000020000000008000000000800000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000800000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000020000000000200000000000000000000000000000000000000000000000000000000").into(),
                        prev_randao: hex!("ebdade0d95216bdba380fce14fad97c870d8553fcf0ca37df22331b3ed498db2").into(),
                        block_number: 663,
                        gas_limit: 41857321,
                        gas_used: 881006,
                        timestamp: 1742914413,
                        extra_data: hex!("d983010e0c846765746888676f312e32332e348664617277696e").into(),
                        base_fee_per_gas: U256::from(7u64),
                        block_hash: hex!("c70c7e5b0a03fa9509e0b4598d65e6e0b6a2477f25064aa3221b39eee17583d4").into(),
                        transactions_root: hex!("065ecaa208638c4a43d080cd78a1451e406895caaa254b1ad0585c6a9e3c7ac6").into(),
                        withdrawals_root: hex!("792930bbd5baac43bcc798ee49aa8185ef76bb3b44ba62b91d86ae569e4bb535").into(),
                        blob_gas_used: 0,
                        excess_blob_gas: 0,
                    }),
                    execution_branch: vec![
                            hex!("ef46bf5d8bd654162c1a7f44949fe1f9cb2a3f356d593587a3f1f3f8da14b790").into(),
                            hex!("b46f0c01805fe212e15907981b757e6c496b0cb06664224655613dcec82505bb").into(),
                            hex!("db56114e00fdd4c1f85c892bf35ac9a89289aaecb1ebd0a96cde606a748b5d71").into(),
                            hex!("b4e39d31736a4064a84ca49c4d372696e92e7c5c7bcbb7219671c24df1dfcafa").into(),
                    ],
                }
            },
        },
        finalized_header: BeaconHeader {
            slot: 864,
            proposer_index: 4,
            parent_root: hex!("2839d32d7b5a1dbb9139c5fd11ea549abaac1ead425c79553b8424550fddd389").into(),
            state_root: hex!("452daf2471437939f4d65af921a1cfee860b11111771fd55164b37fe25d610de").into(),
            body_root: hex!("0bbd0377987d0984e7495bf61219342941e31a0b6fe790453fbc87ec92319097").into(),
        },
        block_roots_root: hex!("aca108d3e77ec6b010ca03df025e3b2e84f754d4642e5d8bf0ba9bdf58f42848").into(),
    }
}
