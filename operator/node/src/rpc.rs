//! A collection of node-specific RPC methods.
//! Substrate provides the `sc-rpc` crate, which defines the core RPC layer
//! used by Substrate nodes. This file extends those RPC definitions with
//! capabilities that are specific to this project's runtime configuration.

#![warn(missing_docs)]

use crate::consensus::BabeConsensusDataProvider;
use crate::eth::DefaultEthConfig;
use datahaven_runtime_common::{
    Block, AccountId, Balance, BlockNumber, Hash, Nonce,
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
use sp_consensus_babe::{BabeApi, SlotDuration};
use sp_consensus_beefy::AuthorityIdBound;
use sp_core::H256;
use sp_runtime::traits::BlakeTwo256;
use sp_runtime::OpaqueExtrinsic;
use std::collections::BTreeMap;
use std::sync::Arc;
use datahaven_runtime_common::time::SLOT_DURATION;

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
pub fn create_full<C, P, BE, AuthorityId, A>(
    deps: FullDeps<C, P, BE, AuthorityId, A>,
) -> Result<RpcModule<()>, Box<dyn std::error::Error + Send + Sync>>
where
    C: ProvideRuntimeApi<Block> + StorageProvider<Block, BE> + AuxStore,
    C: HeaderBackend<Block> + HeaderMetadata<Block, Error = BlockChainError> + 'static,
    C: Send + Sync + 'static,
    C::Api: substrate_frame_rpc_system::AccountNonceApi<Block, AccountId, Nonce>,
    C::Api: pallet_transaction_payment_rpc::TransactionPaymentRuntimeApi<Block, Balance>,
    C::Api: BlockBuilder<Block>,
    C::Api: mmr_rpc::MmrRuntimeApi<Block, <Block as sp_runtime::traits::Block>::Hash, BlockNumber>,
    C::Api: EthereumRuntimeRPCApi<Block>,
    C::Api: BabeApi<Block>,
    C::Api: fp_rpc::ConvertTransactionRuntimeApi<Block>,
    C: sc_client_api::UsageProvider<Block>,
    C: CallApiAt<
        sp_runtime::generic::Block<sp_runtime::generic::Header<u32, BlakeTwo256>, OpaqueExtrinsic>,
    >,
    P: TransactionPool<Block = Block> + 'static,
    BE: Backend<Block> + Send + Sync + 'static,
    BE::State: StateBackend<BlakeTwo256>,
    AuthorityId: AuthorityIdBound,
    A: ChainApi<Block = Block> + 'static,
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
        graph,
        network,
        sync,
        filter_pool,
        frontier_backend,
        backend,
        max_past_logs,
        fee_history_limit,
        fee_history_cache,
        overrides,
        block_data_cache,
        is_authority,
        command_sink,
        forced_parent_hashes,
    } = deps;

    module.merge(System::new(Arc::clone(&client), Arc::clone(&pool)).into_rpc())?;
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
            client.clone(),
            backend
                .offchain_storage()
                .ok_or("Backend doesn't provide the required offchain storage")?,
        )
        .into_rpc(),
    )?;

    enum Never {}
    impl<T> fp_rpc::ConvertTransaction<T> for Never {
        fn convert_transaction(&self, _transaction: pallet_ethereum::Transaction) -> T {
            // The Never type is not instantiable, but this method requires the type to be
            // instantiated to be called (`&self` parameter), so if the code compiles we have the
            // guarantee that this function will never be called.
            unreachable!()
        }
    }
    let convert_transaction: Option<Never> = None;

    let signers = Vec::new();
    let pending_consensus_data_provider: Option<
        Box<(dyn fc_rpc::pending::ConsensusDataProvider<_>)>,
    > = Some(BabeConsensusDataProvider::new().into());

    let pending_create_inherent_data_providers = move |_, _| async move {
        let timestamp = sp_timestamp::InherentDataProvider::from_system_time();
        let slot =
            sp_consensus_babe::inherents::InherentDataProvider::from_timestamp_and_slot_duration(
                *timestamp,
                SlotDuration::from_millis(SLOT_DURATION),
            );
        Ok((slot, timestamp))
    };

    module.merge(
        Eth::<_, _, _, _, _, _, _, DefaultEthConfig<C, BE>>::new(
            Arc::clone(&client),
            Arc::clone(&pool),
            graph.clone(),
            convert_transaction,
            Arc::clone(&sync),
            signers,
            Arc::clone(&overrides),
            Arc::clone(&frontier_backend),
            is_authority,
            Arc::clone(&block_data_cache),
            fee_history_cache,
            fee_history_limit,
            10,
            forced_parent_hashes,
            pending_create_inherent_data_providers,
            pending_consensus_data_provider,
        )
        .into_rpc(),
    )?;

    if let Some(filter_pool) = filter_pool {
        module.merge(
            EthFilter::new(
                client.clone(),
                frontier_backend.clone(),
                graph.clone(),
                filter_pool,
                500_usize, // max stored filters
                max_past_logs,
                block_data_cache,
            )
            .into_rpc(),
        )?;
    }

    module.merge(
        Net::new(
            Arc::clone(&client),
            network.clone(),
            // Whether to format the `peer_count` response as Hex (default) or not.
            true,
        )
        .into_rpc(),
    )?;

    module.merge(Web3::new(Arc::clone(&client)).into_rpc())?;

    if let Some(command_sink) = command_sink {
        module.merge(
            // We provide the rpc handler with the sending end of the channel to allow the rpc
            // send EngineCommands to the background block authorship task.
            ManualSeal::new(command_sink).into_rpc(),
        )?;
    };

    let tx_pool = TxPool::new(client.clone(), graph.clone());
    module.merge(tx_pool.into_rpc())?;

    // module.merge(FrontierFinality::new(client.clone(), frontier_backend.clone()).into_rpc())?;

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
