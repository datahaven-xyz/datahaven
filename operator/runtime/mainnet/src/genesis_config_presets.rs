use crate::{
    configs::BABE_GENESIS_EPOCH_CONFIG, AccountId, BalancesConfig, EVMConfig, Precompiles,
    RuntimeGenesisConfig, SessionKeys, Signature, SudoConfig, TechnicalCommitteeConfig,
    TreasuryCouncilConfig,
};
use alloc::{format, vec, vec::Vec};
use fp_evm::GenesisAccount;
use hex_literal::hex;
use pallet_im_online::sr25519::AuthorityId as ImOnlineId;
use serde_json::Value;
use sp_consensus_babe::AuthorityId as BabeId;
use sp_consensus_beefy::ecdsa_crypto::AuthorityId as BeefyId;
use sp_consensus_grandpa::AuthorityId as GrandpaId;
use sp_core::{ecdsa, Pair, Public};
use sp_genesis_builder::{self, PresetId};
use sp_runtime::traits::{IdentifyAccount, Verify};

const MAINNET_EVM_CHAIN_ID: u64 = 1289;

// Returns the genesis config presets populated with given parameters.
fn testnet_genesis(
    initial_authorities: Vec<(AccountId, BabeId, GrandpaId, ImOnlineId, BeefyId)>,
    root_key: AccountId,
    endowed_accounts: Vec<AccountId>,
    treasury_council_members: Vec<AccountId>,
    technical_committee_members: Vec<AccountId>,
    evm_chain_id: u64,
) -> Value {
    // This is the simplest bytecode to revert without returning any data.
    // We will pre-deploy it under all of our precompiles to ensure they can be called from
    // within contracts.
    // (PUSH1 0x00 PUSH1 0x00 REVERT)
    let revert_bytecode = vec![0x60, 0x00, 0x60, 0x00, 0xFD];

    let config = RuntimeGenesisConfig {
        balances: BalancesConfig {
            balances: endowed_accounts
                .iter()
                .cloned()
                .map(|k| (k, 1u128 << 110))
                .collect::<Vec<_>>(),
        },
        babe: pallet_babe::GenesisConfig {
            epoch_config: BABE_GENESIS_EPOCH_CONFIG,
            ..Default::default()
        },
        evm: EVMConfig {
            // We need _some_ code inserted at the precompile address so that
            // the evm will actually call the address.
            accounts: Precompiles::used_addresses()
                .map(|addr| {
                    (
                        addr.into(),
                        GenesisAccount {
                            nonce: Default::default(),
                            balance: Default::default(),
                            storage: Default::default(),
                            code: revert_bytecode.clone(),
                        },
                    )
                })
                .collect(),
            ..Default::default()
        },
        evm_chain_id: pallet_evm_chain_id::GenesisConfig {
            chain_id: evm_chain_id,
            ..Default::default()
        },
        session: pallet_session::GenesisConfig {
            keys: initial_authorities
                .iter()
                .map(|(account, babe, grandpa, im_online, beefy)| {
                    (
                        *account,
                        *account,
                        session_keys(
                            babe.clone(),
                            grandpa.clone(),
                            im_online.clone(),
                            beefy.clone(),
                        ),
                    )
                })
                .collect::<Vec<_>>(),
            ..Default::default()
        },
        sudo: SudoConfig {
            key: Some(root_key),
        },
        external_validators: pallet_external_validators::GenesisConfig {
            skip_external_validators: false,
            whitelisted_validators: vec![],
            external_validators: initial_authorities
                .iter()
                .map(|(account, ..)| *account)
                .collect::<Vec<_>>()
                .try_into()
                .expect("Too many initial authorities"),
        },
        // Governance pallets configuration
        technical_committee: TechnicalCommitteeConfig {
            phantom: Default::default(),
            members: technical_committee_members,
        },
        treasury_council: TreasuryCouncilConfig {
            phantom: Default::default(),
            members: treasury_council_members,
        },
        ..Default::default()
    };

    serde_json::to_value(config).expect("Could not build genesis config.")
}

/// Return the development genesis config.
pub fn development_config_genesis() -> Value {
    let mut endowed_accounts = pre_funded_accounts();
    endowed_accounts.sort();

    testnet_genesis(
        // Alice is the only authority in Dev mode
        vec![authority_keys_from_seed("Alice")],
        // Alith is Sudo
        alith(),
        // Endowed: Alice, Bob, Charlie, Dave, Eve, Ferdie,
        // Alith, Baltathar, Charleth, Dorothy, Ethan, Frank,
        // Beacon relayer account
        endowed_accounts,
        // Treasury Council members: Baltathar, Charleth and Dorothy
        vec![baltathar(), charleth(), dorothy()],
        // Technical committee members: Alith and Baltathar
        vec![alith(), baltathar()],
        MAINNET_EVM_CHAIN_ID,
    )
}

/// Return the local genesis config preset.
pub fn local_config_genesis() -> Value {
    let mut endowed_accounts = pre_funded_accounts();
    endowed_accounts.sort();

    testnet_genesis(
        // Alice is the only authority in Dev mode
        vec![authority_keys_from_seed("Alice")],
        // Alith is Sudo
        alith(),
        // Endowed: Alice, Bob, Charlie, Dave, Eve, Ferdie,
        // Alith, Baltathar, Charleth, Dorothy, Ethan, Frank,
        // Beacon relayer account
        endowed_accounts,
        // Treasury Council members: Baltathar, Charleth and Dorothy
        vec![baltathar(), charleth(), dorothy()],
        // Technical committee members: Alith and Baltathar
        vec![alith(), baltathar()],
        MAINNET_EVM_CHAIN_ID,
    )
}

/// Provides the JSON representation of predefined genesis config for given `id`.
pub fn get_preset(id: &PresetId) -> Option<Vec<u8>> {
    let patch = match id.as_str() {
        sp_genesis_builder::DEV_RUNTIME_PRESET => development_config_genesis(),
        sp_genesis_builder::LOCAL_TESTNET_RUNTIME_PRESET => local_config_genesis(),
        _ => return None,
    };
    Some(
        serde_json::to_string(&patch)
            .expect("serialization to json is expected to work. qed.")
            .into_bytes(),
    )
}

/// List of supported presets.
pub fn preset_names() -> Vec<PresetId> {
    vec![
        PresetId::from(sp_genesis_builder::DEV_RUNTIME_PRESET),
        PresetId::from(sp_genesis_builder::LOCAL_TESTNET_RUNTIME_PRESET),
    ]
}

/// Generate a crypto pair from seed.
pub fn get_from_seed<TPublic: Public>(seed: &str) -> <TPublic::Pair as Pair>::Public {
    TPublic::Pair::from_string(&format!("//{}", seed), None)
        .expect("static values are valid; qed")
        .public()
}

fn session_keys(
    babe: BabeId,
    grandpa: GrandpaId,
    im_online: ImOnlineId,
    beefy: BeefyId,
) -> SessionKeys {
    SessionKeys {
        babe,
        grandpa,
        im_online,
        beefy,
    }
}

type AccountPublic = <Signature as Verify>::Signer;

/// Generate an account ID from seed.
pub fn get_account_id_from_seed<TPublic: Public>(seed: &str) -> AccountId
where
    AccountPublic: From<<TPublic::Pair as Pair>::Public>,
{
    AccountPublic::from(get_from_seed::<TPublic>(seed)).into_account()
}

/// Generate a Babe authority key.
pub fn authority_keys_from_seed(s: &str) -> (AccountId, BabeId, GrandpaId, ImOnlineId, BeefyId) {
    (
        get_account_id_from_seed::<ecdsa::Public>(s),
        get_from_seed::<BabeId>(s),
        get_from_seed::<GrandpaId>(s),
        get_from_seed::<ImOnlineId>(s),
        get_from_seed::<BeefyId>(s),
    )
}

pub fn alith() -> AccountId {
    AccountId::from(hex!("f24FF3a9CF04c71Dbc94D0b566f7A27B94566cac"))
}

pub fn baltathar() -> AccountId {
    AccountId::from(hex!("3Cd0A705a2DC65e5b1E1205896BaA2be8A07c6e0"))
}

pub fn charleth() -> AccountId {
    AccountId::from(hex!("798d4Ba9baf0064Ec19eB4F0a1a45785ae9D6DFc"))
}

pub fn dorothy() -> AccountId {
    AccountId::from(hex!("773539d4Ac0e786233D90A233654ccEE26a613D9"))
}

pub fn ethan() -> AccountId {
    AccountId::from(hex!("Ff64d3F6efE2317EE2807d2235B1ac2AA69d9E87"))
}

pub fn frank() -> AccountId {
    AccountId::from(hex!("C0F0f4ab324C46e55D02D0033343B4Be8A55532d"))
}

pub fn beacon_relayer() -> AccountId {
    AccountId::from(hex!("c46e141b5083721ad5f5056ba1cded69dce4a65f"))
}

/// Get pre-funded accounts
pub fn pre_funded_accounts() -> Vec<AccountId> {
    // These addresses are derived from Substrate's canonical mnemonic:
    // bottom drive obey lake curtain smoke basket hold race lonely fit walk
    vec![
        get_account_id_from_seed::<ecdsa::Public>("Alice"),
        get_account_id_from_seed::<ecdsa::Public>("Bob"),
        get_account_id_from_seed::<ecdsa::Public>("Charlie"),
        get_account_id_from_seed::<ecdsa::Public>("Dave"),
        get_account_id_from_seed::<ecdsa::Public>("Eve"),
        get_account_id_from_seed::<ecdsa::Public>("Ferdie"),
        alith(),
        baltathar(),
        charleth(),
        dorothy(),
        ethan(),
        frank(),
        beacon_relayer(),
    ]
}
