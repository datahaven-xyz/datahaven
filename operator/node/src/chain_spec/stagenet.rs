use datahaven_stagenet_runtime::WASM_BINARY;
use sc_service::ChainType;

use super::ChainSpec;

const EVM_CHAIN_ID: u64 = 1283;
const SS58_FORMAT: u16 = EVM_CHAIN_ID as u16;
const TOKEN_DECIMALS: u8 = 18;
const TOKEN_SYMBOL: &str = "HAVE";

pub fn development_chain_spec() -> Result<ChainSpec, String> {
    // Give the token a unit name and decimal places
    let mut properties = sc_service::Properties::new();
    properties.insert("tokenSymbol".into(), TOKEN_SYMBOL.into());
    properties.insert("tokenDecimals".into(), TOKEN_DECIMALS.into());
    properties.insert("ss58Format".into(), SS58_FORMAT.into());
    properties.insert("isEthereum".into(), true.into());

    Ok(ChainSpec::builder(
        WASM_BINARY.ok_or_else(|| "Development wasm not available".to_string())?,
        None,
    )
    .with_name("DataHaven Stagenet Dev")
    .with_id("datahaven_stagenet_dev")
    .with_chain_type(ChainType::Development)
    .with_genesis_config_preset_name(sp_genesis_builder::DEV_RUNTIME_PRESET)
    .with_properties(properties)
    .build())
}

pub fn local_chain_spec() -> Result<ChainSpec, String> {
    let mut properties = sc_service::Properties::new();
    properties.insert("tokenSymbol".into(), TOKEN_SYMBOL.into());
    properties.insert("tokenDecimals".into(), TOKEN_DECIMALS.into());
    properties.insert("ss58Format".into(), SS58_FORMAT.into());
    properties.insert("isEthereum".into(), true.into());

    Ok(ChainSpec::builder(
        WASM_BINARY.ok_or_else(|| "Development wasm not available".to_string())?,
        None,
    )
    .with_name("DataHaven Stagenet Local")
    .with_id("datahaven_stagenet_local")
    .with_chain_type(ChainType::Local)
    .with_genesis_config_preset_name(sp_genesis_builder::LOCAL_TESTNET_RUNTIME_PRESET)
    .with_properties(properties)
    .build())
}
