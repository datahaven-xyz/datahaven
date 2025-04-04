use datahaven_runtime::{
    configs::BABE_GENESIS_EPOCH_CONFIG, AccountId, SessionKeys, Signature, WASM_BINARY,
};
use hex_literal::hex;
use pallet_im_online::sr25519::AuthorityId as ImOnlineId;
use sc_service::ChainType;
use sp_consensus_babe::AuthorityId as BabeId;
use sp_consensus_beefy::ecdsa_crypto::AuthorityId as BeefyId;
use sp_consensus_grandpa::AuthorityId as GrandpaId;
use sp_core::{ecdsa, Pair, Public};
use sp_runtime::traits::{IdentifyAccount, Verify};

const EVM_CHAIN_ID: u64 = 1289;
const SS58_FORMAT: u16 = EVM_CHAIN_ID as u16;
const TOKEN_DECIMALS: u8 = 18;
const TOKEN_SYMBOL: &str = "HAVE";

/// Specialized `ChainSpec`. This is a specialization of the general Substrate ChainSpec type.
pub type ChainSpec = sc_service::GenericChainSpec;

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

pub fn development_config() -> Result<ChainSpec, String> {
    let mut default_funded_accounts = pre_funded_accounts();
    default_funded_accounts.sort();
    default_funded_accounts.dedup();

    // Give your stout currency a unit name and decimal places
    let mut properties = sc_service::Properties::new();
    properties.insert("tokenSymbol".into(), TOKEN_SYMBOL.into());
    properties.insert("tokenDecimals".into(), TOKEN_DECIMALS.into());
    properties.insert("ss58Format".into(), SS58_FORMAT.into());

    Ok(ChainSpec::builder(
        WASM_BINARY.ok_or_else(|| "Development wasm not available".to_string())?,
        None,
    )
    .with_name("Development")
    .with_id("dev")
    .with_chain_type(ChainType::Development)
    .with_genesis_config_patch(testnet_genesis(
        // Initial PoA authorities
        vec![authority_keys_from_seed("Alice")],
        // Sudo account
        alith(),
        // Pre-funded accounts
        default_funded_accounts.clone(),
        true,
    ))
    .with_properties(properties)
    .build())
}

pub fn local_testnet_config() -> Result<ChainSpec, String> {
    let mut properties = sc_service::Properties::new();
    properties.insert("tokenSymbol".into(), TOKEN_SYMBOL.into());
    properties.insert("tokenDecimals".into(), TOKEN_DECIMALS.into());
    properties.insert("ss58Format".into(), SS58_FORMAT.into());

    Ok(ChainSpec::builder(
        WASM_BINARY.ok_or_else(|| "Development wasm not available".to_string())?,
        None,
    )
    .with_name("Local Testnet")
    .with_id("local_testnet")
    .with_chain_type(ChainType::Local)
    .with_genesis_config_patch(testnet_genesis(
        // Initial PoA authorities
        vec![
            authority_keys_from_seed("Alice"),
            authority_keys_from_seed("Bob"),
            authority_keys_from_seed("Charlie"),
            authority_keys_from_seed("Dave"),
            authority_keys_from_seed("Eve"),
            authority_keys_from_seed("Ferdie"),
        ],
        // Sudo account
        alith(),
        // Pre-funded accounts
        vec![
            alith(),
            baltathar(),
            charleth(),
            dorothy(),
            ethan(),
            frank(),
        ],
        true,
    ))
    .with_properties(properties)
    .build())
}

/// Configure initial storage state for FRAME modules.
fn testnet_genesis(
    initial_authorities: Vec<(AccountId, BabeId, GrandpaId, ImOnlineId, BeefyId)>,
    root_key: AccountId,
    endowed_accounts: Vec<AccountId>,
    _enable_println: bool,
) -> serde_json::Value {
    serde_json::json!({
        "balances": {
            // Configure endowed accounts with initial balance of 1 << 60.
            "balances": endowed_accounts.iter().cloned().map(|k| (k, 1u64 << 60)).collect::<Vec<_>>(),
        },
        "babe": {
            "epochConfig": Some(BABE_GENESIS_EPOCH_CONFIG),
        },
        "grandpa": {},
        "imOnline": {},
        "sudo": {
            // Assign network admin rights.
            "key": Some(root_key),
        },
        "validatorSet": {
            "initialValidators": initial_authorities.iter().map(|x| x.0).collect::<Vec<_>>(),
        },
        "session": {
            "keys": initial_authorities.iter().map(|x| {
                (x.0, x.0, session_keys(x.1.clone(), x.2.clone(), x.3.clone(), x.4.clone()))
            }).collect::<Vec<_>>(),
        },
        "evmChainId": {
            // EVM chain ID
            "chainId": EVM_CHAIN_ID,
        },
    })
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
        alith(),
        baltathar(),
        charleth(),
        dorothy(),
        ethan(),
        frank(),
        beacon_relayer(),
    ]
}
