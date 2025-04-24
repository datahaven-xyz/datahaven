//! A collection of node-specific RPC methods.
//! Substrate provides the `sc-rpc` crate, which defines the core RPC layer
//! used by Substrate nodes. This file extends those RPC definitions with
//! capabilities that are specific to this project's runtime configuration.

#![warn(missing_docs)]

use crate::consensus::BabeConsensusDataProvider;
use crate::eth::DefaultEthConfig;
use datahaven_runtime::{
    opaque::Block, AccountId, Balance, BlockNumber, Hash, Nonce, SLOT_DURATION,
};
use fc_rpc::TxPool;
use fc_rpc::{Eth, EthBlockDataCacheTask, EthFilter, Net, Web3};
use fc_rpc_core::types::{FeeHistoryCache, FilterPool};
use fc_rpc_core::{EthApiServer, EthFilterApiServer, NetApiServer, TxPoolApiServer, Web3ApiServer};
use fc_storage::StorageOverride;
use fp_rpc::EthereumRuntimeRPCApi;
use jsonrpsee::RpcModule;
use sc_client_api::{AuxStore, Backend, StateBackend, StorageProvider};
use sc_consensus_beefy::communication::notification::{
    BeefyBestBlockStream, BeefyVersionedFinalityProofStream,
};
use sc_consensus_manual_seal::rpc::{EngineCommand, ManualSeal, ManualSealApiServer};
use sc_network_sync::SyncingService;
use sc_transaction_pool::{ChainApi, Pool};
use sc_transaction_pool_api::TransactionPool;
use sp_api::{CallApiAt, ProvideRuntimeApi};
use sp_block_builder::BlockBuilder;
use sp_blockchain::{Error as BlockChainError, HeaderBackend, HeaderMetadata};
use sp_consensus_babe::BabeApi;
use sp_consensus_beefy::AuthorityIdBound;
use sp_consensus_slots::SlotDuration;
use sp_core::H256;
use sp_runtime::traits::BlakeTwo256;
use sp_runtime::OpaqueExtrinsic;
use std::collections::BTreeMap;
use std::sync::Arc;

/// Dependencies for BEEFY
pub struct BeefyDeps<AuthorityId: AuthorityIdBound> {
    /// Receives notifications about finality proof events from BEEFY.
    pub beefy_finality_proof_stream: BeefyVersionedFinalityProofStream<Block, AuthorityId>,
    /// Receives notifications about best block events from BEEFY.
    pub beefy_best_block_stream: BeefyBestBlockStream<Block>,
    /// Executor to drive the subscription manager in the BEEFY RPC handler.
    pub subscription_executor: sc_rpc::SubscriptionTaskExecutor,
}

/// Full client dependencies.
pub struct FullDeps<C, P, B, AuthorityId: AuthorityIdBound, A: ChainApi> {
    /// The client instance to use.
    pub client: Arc<C>,
    /// Transaction pool instance.
    pub pool: Arc<P>,
    /// BEEFY dependencies.
    pub beefy: BeefyDeps<AuthorityId>,
    /// Graph pool instance.
    pub graph: Arc<Pool<A>>,
    /// Backend used by the node.
    pub backend: Arc<B>,
    /// Network service
    pub network: Arc<dyn sc_network::service::traits::NetworkService>,
    /// Chain syncing service
    pub sync: Arc<SyncingService<Block>>,
    /// EthFilterApi pool.
    pub filter_pool: Option<FilterPool>,
    /// Frontier Backend.
    pub frontier_backend: Arc<dyn fc_api::Backend<Block>>,
    /// Maximum number of logs in a query.
    pub max_past_logs: u32,
    /// Maximum fee history cache size.
    pub fee_history_limit: u64,
    /// Fee history cache.
    pub fee_history_cache: FeeHistoryCache,
    /// Ethereum data access overrides.
    pub overrides: Arc<dyn StorageOverride<Block>>,
    /// Cache for Ethereum block data.
    pub block_data_cache: Arc<EthBlockDataCacheTask<Block>>,
    /// The Node authority flag
    pub is_authority: bool,
    /// Manual seal command sink
    pub command_sink: Option<futures::channel::mpsc::Sender<EngineCommand<Hash>>>,
    /// Mandated parent hashes for a given block hash.
    pub forced_parent_hashes: Option<BTreeMap<H256, H256>>,
}

/// Instantiate all full RPC extensions.
pub fn create_full<C, P, B, AuthorityId>(
    deps: FullDeps<C, P, B, AuthorityId>,
) -> Result<RpcModule<()>, Box<dyn std::error::Error + Send + Sync>>
where
    C: ProvideRuntimeApi<Block>,
    C: HeaderBackend<Block> + HeaderMetadata<Block, Error = BlockChainError> + 'static,
    C: Send + Sync + 'static,
    C::Api: substrate_frame_rpc_system::AccountNonceApi<Block, AccountId, Nonce>,
    C::Api: pallet_transaction_payment_rpc::TransactionPaymentRuntimeApi<Block, Balance>,
    C::Api: BlockBuilder<Block>,
    C::Api: mmr_rpc::MmrRuntimeApi<Block, <Block as sp_runtime::traits::Block>::Hash, BlockNumber>,
    P: TransactionPool + 'static,
    B: sc_client_api::Backend<Block> + Send + Sync + 'static,
    B::State: sc_client_api::StateBackend<sp_runtime::traits::HashingFor<Block>>,
    AuthorityId: AuthorityIdBound,
{
    use mmr_rpc::{Mmr, MmrApiServer};
    use pallet_transaction_payment_rpc::{TransactionPayment, TransactionPaymentApiServer};
    use sc_consensus_beefy_rpc::{Beefy, BeefyApiServer};
    use substrate_frame_rpc_system::{System, SystemApiServer};

    let mut module = RpcModule::new(());
    let FullDeps {
        client,
        pool,
        beefy,
        backend,
    } = deps;

    module.merge(System::new(client.clone(), pool).into_rpc())?;
    module.merge(TransactionPayment::new(client.clone()).into_rpc())?;
    module.merge(
        Beefy::<Block, AuthorityId>::new(
            beefy.beefy_finality_proof_stream,
            beefy.beefy_best_block_stream,
            beefy.subscription_executor,
        )?
        .into_rpc(),
    )?;
    module.merge(
        Mmr::new(
            client,
            backend
                .offchain_storage()
                .ok_or("Backend doesn't provide the required offchain storage")?,
        )
        .into_rpc(),
    )?;

    // Extend this RPC with a custom API by using the following syntax.
    // `YourRpcStruct` should have a reference to a client, which is needed
    // to call into the runtime.
    // `module.merge(YourRpcTrait::into_rpc(YourRpcStruct::new(ReferenceToClient, ...)))?;`

    // You probably want to enable the `rpc v2 chainSpec` API as well
    //
    // let chain_name = chain_spec.name().to_string();
    // let genesis_hash = client.block_hash(0).ok().flatten().expect("Genesis block exists; qed");
    // let properties = chain_spec.properties();
    // module.merge(ChainSpec::new(chain_name, genesis_hash, properties).into_rpc())?;

    Ok(module)
}
