// Copyright 2025 DataHaven
// This file is part of DataHaven.

// DataHaven is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// DataHaven is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with DataHaven.  If not, see <http://www.gnu.org/licenses/>.

//! Service and ServiceFactory implementation. Specialized wrapper over substrate service.

use crate::cli::{ProviderType, Sealing, StorageLayer};
use crate::command::{ProviderOptions, RoleOptions};
use crate::eth::{
    new_frontier_partial, spawn_frontier_tasks, BackendType, FrontierBackend,
    FrontierPartialComponents, FrontierTasksParams,
};
use crate::eth::{EthConfiguration, StorageOverrideHandler};
use crate::rpc::BeefyDeps;
use async_channel::Receiver;
use datahaven_runtime_common::{AccountId, Balance, Block, BlockNumber, Hash, Nonce};
use fc_consensus::FrontierBlockImport;
use fc_db::DatabaseSource;
use fc_storage::StorageOverride;
use futures::channel::mpsc;
use futures::FutureExt;
use log::info;
use sc_client_api::{AuxStore, Backend, BlockBackend, StateBackend, StorageProvider};
use sc_consensus_babe::ImportQueueParams;
use sc_consensus_grandpa::SharedVoterState;
use sc_consensus_manual_seal::consensus::babe::BabeConsensusDataProvider;
use sc_consensus_manual_seal::rpc::EngineCommand;
use sc_consensus_manual_seal::{self, InstantSealParams, ManualSealParams};
use sc_executor::{HeapAllocStrategy, WasmExecutor, DEFAULT_HEAP_ALLOC_STRATEGY};
use sc_network::request_responses::IncomingRequest;
use sc_network::service::traits::NetworkService;
use sc_network::ProtocolName;
use sc_service::RpcHandlers;
use sc_service::{
    error::Error as ServiceError, ChainType, Configuration, TaskManager, WarpSyncConfig,
};
use sc_telemetry::{Telemetry, TelemetryWorker};
use sc_transaction_pool::BasicPool;
use sc_transaction_pool_api::OffchainTransactionPoolFactory;
use shc_actors_framework::actor::TaskSpawner;
use shc_blockchain_service::capacity_manager::CapacityConfig;
use shc_client::types::FishermanRole;
use shc_client::{
    builder::{
        Buildable, FishermanOptions, IndexerOptions, StorageHubBuilder, StorageLayerBuilder,
    },
    handler::{RunnableTasks, StorageHubHandler},
    types::{
        BspProvider, InMemoryStorageLayer, MspProvider, NoStorageLayer, RocksDbStorageLayer,
        ShNodeType, ShRole, ShStorageLayer, UserRole,
    },
};
use shc_common::traits::StorageEnableRuntime;
use shc_common::types::StorageHubClient;
use shc_file_transfer_service::fetch_genesis_hash;
use shc_indexer_db::DbPool;
use shc_indexer_service::spawn_indexer_service;
use shc_rpc::{RpcConfig, StorageHubClientRpcConfig};
use sp_api::ProvideRuntimeApi;
use sp_blockchain::{Error as BlockChainError, HeaderBackend, HeaderMetadata};
use sp_consensus_beefy::ecdsa_crypto::AuthorityId as BeefyId;
use sp_keystore::KeystorePtr;
use sp_runtime::traits::BlakeTwo256;
use sp_runtime::SaturatedConversion;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::{default::Default, path::Path, sync::Arc, time::Duration};

pub(crate) type FullClient<RuntimeApi> = StorageHubClient<RuntimeApi>;

type FullBackend = sc_service::TFullBackend<Block>;
type FullSelectChain = sc_consensus::LongestChain<FullBackend, Block>;
type FullGrandpaBlockImport<RuntimeApi> = sc_consensus_grandpa::GrandpaBlockImport<
    FullBackend,
    Block,
    FullClient<RuntimeApi>,
    FullSelectChain,
>;
type FullBeefyBlockImport<InnerBlockImport, AuthorityId, RuntimeApi> =
    sc_consensus_beefy::import::BeefyBlockImport<
        Block,
        FullBackend,
        FullClient<RuntimeApi>,
        InnerBlockImport,
        AuthorityId,
    >;

/// The minimum period of blocks on which justifications will be
/// imported and generated.
const GRANDPA_JUSTIFICATION_PERIOD: u32 = 512;

// Mock timestamp used for manual/instant sealing in dev mode, similar to Moonbeam.
// Each new block will advance the timestamp by one slot duration to satisfy
// pallet_timestamp MinimumPeriod checks when sealing back-to-back.
static MOCK_TIMESTAMP: AtomicU64 = AtomicU64::new(0);

pub(crate) trait FullRuntimeApi:
    sp_transaction_pool::runtime_api::TaggedTransactionQueue<Block>
    + sp_api::Metadata<Block>
    + crate::eth::EthCompatRuntimeApiCollection<Block>
    + frame_system_rpc_runtime_api::AccountNonceApi<Block, AccountId, Nonce>
    + sp_session::SessionKeys<Block>
    + sp_api::ApiExt<Block>
    + pallet_mmr::primitives::MmrApi<Block, Hash, BlockNumber>
    + pallet_beefy_mmr::BeefyMmrApi<Block, Hash>
    + sp_consensus_beefy::BeefyApi<Block, BeefyId>
    + pallet_transaction_payment_rpc_runtime_api::TransactionPaymentApi<Block, Balance>
    + sp_offchain::OffchainWorkerApi<Block>
    + sp_block_builder::BlockBuilder<Block>
    + sp_consensus_babe::BabeApi<Block>
    + sp_consensus_grandpa::GrandpaApi<Block>
    + fp_rpc::ConvertTransactionRuntimeApi<Block>
    + fp_rpc::EthereumRuntimeRPCApi<Block>
{
}

impl<T> FullRuntimeApi for T where
    T: sp_transaction_pool::runtime_api::TaggedTransactionQueue<Block>
        + sp_api::Metadata<Block>
        + crate::eth::EthCompatRuntimeApiCollection<Block>
        + frame_system_rpc_runtime_api::AccountNonceApi<Block, AccountId, Nonce>
        + sp_session::SessionKeys<Block>
        + sp_api::ApiExt<Block>
        + pallet_mmr::primitives::MmrApi<Block, Hash, BlockNumber>
        + pallet_beefy_mmr::BeefyMmrApi<Block, Hash>
        + sp_consensus_beefy::BeefyApi<Block, BeefyId>
        + pallet_transaction_payment_rpc_runtime_api::TransactionPaymentApi<Block, Balance>
        + sp_offchain::OffchainWorkerApi<Block>
        + sp_block_builder::BlockBuilder<Block>
        + sp_consensus_babe::BabeApi<Block>
        + sp_consensus_grandpa::GrandpaApi<Block>
        + fp_rpc::ConvertTransactionRuntimeApi<Block>
        + fp_rpc::EthereumRuntimeRPCApi<Block>
{
}

pub type Service<RuntimeApi> = sc_service::PartialComponents<
    FullClient<RuntimeApi>,
    FullBackend,
    FullSelectChain,
    sc_consensus::DefaultImportQueue<Block>,
    sc_transaction_pool::BasicPool<
        sc_transaction_pool::FullChainApi<FullClient<RuntimeApi>, Block>,
        Block,
    >,
    (
        sc_consensus_babe::BabeBlockImport<
            Block,
            FullClient<RuntimeApi>,
            FullBeefyBlockImport<
                FrontierBlockImport<
                    Block,
                    FullGrandpaBlockImport<RuntimeApi>,
                    FullClient<RuntimeApi>,
                >,
                BeefyId,
                RuntimeApi,
            >,
        >,
        sc_consensus_grandpa::LinkHalf<Block, FullClient<RuntimeApi>, FullSelectChain>,
        sc_consensus_babe::BabeLink<Block>,
        sc_consensus_beefy::BeefyVoterLinks<Block, BeefyId>,
        sc_consensus_beefy::BeefyRPCLinks<Block, BeefyId>,
        Arc<fc_db::Backend<Block, FullClient<RuntimeApi>>>,
        Arc<dyn StorageOverride<Block>>,
        Option<Telemetry>,
    ),
>;

// StorageHub Enable client
pub(crate) type StorageEnableClient<Runtime> =
    shc_common::types::StorageHubClient<<Runtime as StorageEnableRuntime>::RuntimeApi>;

pub fn frontier_database_dir(config: &Configuration, path: &str) -> std::path::PathBuf {
    config
        .base_path
        .config_dir(config.chain_spec.id())
        .join("frontier")
        .join(path)
}

pub fn open_frontier_backend<C, BE>(
    client: Arc<C>,
    config: &Configuration,
    eth_config: &mut EthConfiguration,
) -> Result<FrontierBackend<Block, C>, String>
where
    C: ProvideRuntimeApi<Block> + StorageProvider<Block, BE> + AuxStore,
    C: HeaderBackend<Block> + HeaderMetadata<Block, Error = BlockChainError>,
    C: Send + Sync + 'static,
    C::Api: fp_rpc::EthereumRuntimeRPCApi<Block>,
    BE: Backend<Block> + 'static,
    BE::State: StateBackend<BlakeTwo256>,
{
    let frontier_backend = match eth_config.frontier_backend_type {
        BackendType::KeyValue => {
            fc_db::Backend::KeyValue(Arc::new(fc_db::kv::Backend::<Block, C>::new(
                client,
                &fc_db::kv::DatabaseSettings {
                    source: match config.database {
                        DatabaseSource::RocksDb { .. } => DatabaseSource::RocksDb {
                            path: frontier_database_dir(config, "db"),
                            cache_size: 0,
                        },
                        DatabaseSource::ParityDb { .. } => DatabaseSource::ParityDb {
                            path: frontier_database_dir(config, "paritydb"),
                        },
                        DatabaseSource::Auto { .. } => DatabaseSource::Auto {
                            rocksdb_path: frontier_database_dir(config, "db"),
                            paritydb_path: frontier_database_dir(config, "paritydb"),
                            cache_size: 0,
                        },
                        _ => {
                            return Err(
                                "Supported db sources: `rocksdb` | `paritydb` | `auto`".to_string()
                            )
                        }
                    },
                },
            )?))
        }
        BackendType::Sql => {
            let overrides = Arc::new(StorageOverrideHandler::new(client.clone()));
            let sqlite_db_path = frontier_database_dir(config, "sql");
            std::fs::create_dir_all(&sqlite_db_path).expect("failed creating sql db directory");
            let backend = futures::executor::block_on(fc_db::sql::Backend::new(
                fc_db::sql::BackendConfig::Sqlite(fc_db::sql::SqliteBackendConfig {
                    path: Path::new("sqlite:///")
                        .join(sqlite_db_path)
                        .join("frontier.db3")
                        .to_str()
                        .expect("frontier sql path error"),
                    create_if_missing: true,
                    thread_count: eth_config.frontier_sql_backend_thread_count,
                    cache_size: eth_config.frontier_sql_backend_cache_size,
                }),
                eth_config.frontier_sql_backend_pool_size,
                std::num::NonZeroU32::new(eth_config.frontier_sql_backend_num_ops_timeout),
                overrides.clone(),
            ))
            .unwrap_or_else(|err| panic!("failed creating sql backend: {:?}", err));
            fc_db::Backend::Sql(Arc::new(backend))
        }
    };

    Ok(frontier_backend)
}

fn build_babe_inherent_providers(
    slot_duration: sp_consensus_babe::SlotDuration,
    use_mock_timestamp: bool,
) -> (
    sp_consensus_babe::inherents::InherentDataProvider,
    sp_timestamp::InherentDataProvider,
) {
    if use_mock_timestamp {
        // In manual/instant sealing we want to advance time deterministically per block
        // to satisfy `pallet_timestamp` MinimumPeriod without sleeping. We increment a
        // static counter by one slot each time and use that value as the timestamp.
        let increment = slot_duration.as_millis();
        let next_ts = MOCK_TIMESTAMP
            .fetch_add(increment, Ordering::SeqCst)
            .saturating_add(increment);
        let timestamp =
            sp_timestamp::InherentDataProvider::new(sp_timestamp::Timestamp::new(next_ts));
        let slot =
            sp_consensus_babe::inherents::InherentDataProvider::from_timestamp_and_slot_duration(
                *timestamp,
                slot_duration,
            );
        (slot, timestamp)
    } else {
        let timestamp = sp_timestamp::InherentDataProvider::from_system_time();
        let slot =
            sp_consensus_babe::inherents::InherentDataProvider::from_timestamp_and_slot_duration(
                *timestamp,
                slot_duration,
            );
        (slot, timestamp)
    }
}

pub fn new_partial<Runtime, RuntimeApi>(
    config: &Configuration,
    eth_config: &mut EthConfiguration,
    use_mock_timestamp: bool,
) -> Result<Service<RuntimeApi>, ServiceError>
where
    Runtime: shc_common::traits::StorageEnableRuntime,
    RuntimeApi: sp_api::ConstructRuntimeApi<Block, FullClient<RuntimeApi>> + Send + Sync + 'static,
    RuntimeApi::RuntimeApi: FullRuntimeApi,
{
    let telemetry = config
        .telemetry_endpoints
        .clone()
        .filter(|x| !x.is_empty())
        .map(|endpoints| -> Result<_, sc_telemetry::Error> {
            let worker = TelemetryWorker::new(16)?;
            let telemetry = worker.handle().new_telemetry(endpoints);
            Ok((worker, telemetry))
        })
        .transpose()?;

    let heap_pages = config
        .executor
        .default_heap_pages
        .map_or(DEFAULT_HEAP_ALLOC_STRATEGY, |h| HeapAllocStrategy::Static {
            extra_pages: h as _,
        });

    let wasm_builder = WasmExecutor::builder()
        .with_execution_method(config.executor.wasm_method)
        .with_onchain_heap_alloc_strategy(heap_pages)
        .with_offchain_heap_alloc_strategy(heap_pages)
        .with_ignore_onchain_heap_pages(true)
        .with_max_runtime_instances(config.executor.max_runtime_instances)
        .with_runtime_cache_size(config.executor.runtime_cache_size);

    let executor = wasm_builder.build();

    let (client, backend, keystore_container, task_manager) =
        sc_service::new_full_parts::<Block, RuntimeApi, _>(
            config,
            telemetry.as_ref().map(|(_, telemetry)| telemetry.handle()),
            executor,
        )?;

    let client = Arc::new(client);

    let telemetry = telemetry.map(|(worker, telemetry)| {
        task_manager
            .spawn_handle()
            .spawn("telemetry", None, worker.run());
        telemetry
    });

    let select_chain = sc_consensus::LongestChain::new(backend.clone());

    // FIXME: The `config.transaction_pool.options` field is private, so for now use its default value
    let transaction_pool = Arc::from(BasicPool::new_full(
        Default::default(),
        config.role.is_authority().into(),
        config.prometheus_registry(),
        task_manager.spawn_essential_handle(),
        client.clone(),
    ));

    let (grandpa_block_import, grandpa_link) = sc_consensus_grandpa::block_import(
        client.clone(),
        GRANDPA_JUSTIFICATION_PERIOD,
        &client,
        select_chain.clone(),
        telemetry.as_ref().map(|x| x.handle()),
    )?;

    let frontier_block_import =
        FrontierBlockImport::new(grandpa_block_import.clone(), client.clone());

    let (beefy_block_import, beefy_voter_links, beefy_rpc_links) =
        sc_consensus_beefy::beefy_block_import_and_links(
            frontier_block_import,
            backend.clone(),
            client.clone(),
            config.prometheus_registry().cloned(),
        );

    let (block_import, babe_link) = sc_consensus_babe::block_import(
        sc_consensus_babe::configuration(&*client)?,
        beefy_block_import,
        client.clone(),
    )?;

    let slot_duration = babe_link.config().slot_duration();

    let storage_override = Arc::new(StorageOverrideHandler::<Block, _, _>::new(client.clone()));
    let frontier_backend = Arc::new(open_frontier_backend(client.clone(), config, eth_config)?);

    let (import_queue, babe_worker_handle) = sc_consensus_babe::import_queue(ImportQueueParams {
        link: babe_link.clone(),
        block_import: block_import.clone(),
        justification_import: Some(Box::new(grandpa_block_import.clone())),
        client: client.clone(),
        select_chain: select_chain.clone(),
        create_inherent_data_providers: move |_, ()| {
            std::future::ready(Ok::<_, Box<dyn std::error::Error + Send + Sync>>(
                build_babe_inherent_providers(slot_duration, use_mock_timestamp),
            ))
        },
        spawner: &task_manager.spawn_essential_handle(),
        registry: config.prometheus_registry(),
        telemetry: telemetry.as_ref().map(|x| x.handle()),
        offchain_tx_pool_factory: OffchainTransactionPoolFactory::new(transaction_pool.clone()),
    })?;

    // TODO Wire up to RPC
    std::mem::forget(babe_worker_handle);

    Ok(sc_service::PartialComponents {
        client,
        backend,
        task_manager,
        import_queue,
        keystore_container,
        select_chain,
        transaction_pool,
        other: (
            block_import,
            grandpa_link,
            babe_link,
            beefy_voter_links,
            beefy_rpc_links,
            frontier_backend,
            storage_override,
            telemetry,
        ),
    })
}

/// Builds a new service for a full client.
// TODO: Find a way to remove `RuntimeApi` and to just keep `Runtime`
pub async fn new_full_impl<
    R: ShRole,
    S: ShStorageLayer,
    Runtime,
    RuntimeApi,
    N: sc_network::NetworkBackend<Block, <Block as sp_runtime::traits::Block>::Hash>,
>(
    config: Configuration,
    mut eth_config: EthConfiguration,
    role_options: Option<RoleOptions>,
    indexer_options: Option<IndexerOptions>,
    sealing: Option<Sealing>,
) -> Result<TaskManager, ServiceError>
where
    Runtime: shc_common::traits::StorageEnableRuntime<RuntimeApi = RuntimeApi>,
    RuntimeApi: sp_api::ConstructRuntimeApi<Block, FullClient<RuntimeApi>> + Send + Sync + 'static,
    RuntimeApi::RuntimeApi: FullRuntimeApi,
    (R, S): ShNodeType<Runtime>,
    StorageHubBuilder<R, S, Runtime>: StorageLayerBuilder + Buildable<(R, S), Runtime>,
    StorageHubHandler<(R, S), Runtime>: RunnableTasks,
{
    let role = config.role;
    let mut sealing = match sealing {
        Some(_) if !matches!(config.chain_spec.chain_type(), ChainType::Development) => {
            log::warn!("Manual sealing is only available for development chains; disabling.");
            None
        }
        other => other,
    };

    if sealing.is_some() && !role.is_authority() {
        log::warn!(
            "Manual sealing requested but the node is not running as an authority; disabling."
        );
        sealing = None;
    }

    let use_mock_timestamp = sealing.is_some();

    let sc_service::PartialComponents {
        client,
        backend,
        mut task_manager,
        import_queue,
        keystore_container,
        select_chain,
        transaction_pool,
        other:
            (
                block_import,
                grandpa_link,
                babe_link,
                beefy_voter_links,
                beefy_rpc_links,
                frontier_backend,
                storage_override,
                mut telemetry,
            ),
    } = new_partial::<Runtime, RuntimeApi>(&config, &mut eth_config, use_mock_timestamp)?;

    let is_authority = role.is_authority();

    let FrontierPartialComponents {
        filter_pool,
        fee_history_cache,
        fee_history_cache_limit,
    } = new_frontier_partial(&eth_config)?;

    let mut net_config = sc_network::config::FullNetworkConfiguration::<
        Block,
        <Block as sp_runtime::traits::Block>::Hash,
        N,
    >::new(&config.network, config.prometheus_registry().cloned());

    // Starting StorageHub file transfer service.
    let mut file_transfer_request_protocol = None;
    if role_options.is_some() {
        file_transfer_request_protocol = Some(
            shc_file_transfer_service::configure_file_transfer_network::<_, Runtime>(
                fetch_genesis_hash(client.clone()),
                config.chain_spec.fork_id(),
                &mut net_config,
            ),
        );
    }

    let metrics = N::register_notification_metrics(config.prometheus_registry());

    let peer_store_handle = net_config.peer_store_handle();
    let genesis_hash = client
        .block_hash(0)
        .ok()
        .flatten()
        .expect("Genesis block exists; qed");
    let grandpa_protocol_name =
        sc_consensus_grandpa::protocol_standard_name(&genesis_hash, &config.chain_spec);

    let (grandpa_protocol_config, grandpa_notification_service) =
        sc_consensus_grandpa::grandpa_peers_set_config::<_, N>(
            grandpa_protocol_name.clone(),
            metrics.clone(),
            Arc::clone(&peer_store_handle),
        );
    net_config.add_notification_protocol(grandpa_protocol_config);

    let beefy_gossip_proto_name =
        sc_consensus_beefy::gossip_protocol_name(genesis_hash, config.chain_spec.fork_id());
    let (beefy_on_demand_justifications_handler, beefy_req_resp_cfg) =
        sc_consensus_beefy::communication::request_response::BeefyJustifsRequestHandler::new::<_, N>(
            &genesis_hash,
            config.chain_spec.fork_id(),
            client.clone(),
            config.prometheus_registry().cloned(),
        );
    let enable_beefy = true;
    let beefy_notification_service = match enable_beefy {
        false => None,
        true => {
            let (beefy_notification_config, beefy_notification_service) =
                sc_consensus_beefy::communication::beefy_peers_set_config::<_, N>(
                    beefy_gossip_proto_name.clone(),
                    metrics.clone(),
                    Arc::clone(&peer_store_handle),
                );

            net_config.add_notification_protocol(beefy_notification_config);
            net_config.add_request_response_protocol(beefy_req_resp_cfg);
            Some(beefy_notification_service)
        }
    };

    let warp_sync = Arc::new(sc_consensus_grandpa::warp_proof::NetworkProvider::new(
        backend.clone(),
        grandpa_link.shared_authority_set().clone(),
        Vec::default(),
    ));

    let (network, system_rpc_tx, tx_handler_controller, network_starter, sync_service) =
        sc_service::build_network(sc_service::BuildNetworkParams {
            config: &config,
            net_config,
            client: client.clone(),
            transaction_pool: transaction_pool.clone(),
            spawn_handle: task_manager.spawn_handle(),
            import_queue,
            block_announce_validator_builder: None,
            warp_sync_config: Some(WarpSyncConfig::WithProvider(warp_sync)),
            block_relay: None,
            metrics,
        })?;

    if config.offchain_worker.enabled {
        task_manager.spawn_handle().spawn(
            "offchain-workers-runner",
            "offchain-worker",
            sc_offchain::OffchainWorkers::new(sc_offchain::OffchainWorkerOptions {
                runtime_api_provider: client.clone(),
                is_validator: config.role.is_authority(),
                keystore: Some(keystore_container.keystore()),
                offchain_db: backend.offchain_storage(),
                transaction_pool: Some(OffchainTransactionPoolFactory::new(
                    transaction_pool.clone(),
                )),
                network_provider: Arc::new(network.clone()),
                enable_http_requests: true,
                custom_extensions: |_| vec![],
            })?
            .run(client.clone(), task_manager.spawn_handle())
            .boxed(),
        );
    }

    // Storage Hub builder
    let (sh_builder, maybe_storage_hub_client_rpc_config) = match init_sh_builder::<R, S, Runtime>(
        &role_options,
        &indexer_options,
        &task_manager,
        file_transfer_request_protocol,
        network.clone(),
        keystore_container.keystore(),
        client.clone(),
    )
    .await?
    {
        Some((shb, rpc)) => (Some(shb), Some(rpc)),
        None => (None, None),
    };

    let force_authoring = config.force_authoring;
    let backoff_authoring_blocks: Option<()> = None;
    let name = config.network.node_name.clone();
    let enable_grandpa = sealing.is_none() && !config.disable_grandpa;
    let prometheus_registry = config.prometheus_registry().cloned();
    let overrides = Arc::new(StorageOverrideHandler::new(client.clone()));

    let block_data_cache = Arc::new(fc_rpc::EthBlockDataCacheTask::new(
        task_manager.spawn_handle(),
        overrides.clone(),
        eth_config.eth_log_block_cache,
        eth_config.eth_statuses_cache,
        prometheus_registry.clone(),
    ));

    let mut manual_commands_stream: Option<mpsc::Receiver<EngineCommand<Hash>>> = None;
    let command_sink = if matches!(sealing, Some(Sealing::Manual)) {
        let (sink, stream) = mpsc::channel::<EngineCommand<Hash>>(1000);
        manual_commands_stream = Some(stream);
        Some(sink)
    } else {
        None
    };

    // Sinks for pubsub notifications.
    // Everytime a new subscription is created, a new mpsc channel is added to the sink pool.
    // The MappingSyncWorker sends through the channel on block import and the subscription emits a notification to the subscriber on receiving a message through this channel.
    // This way we avoid race conditions when using native substrate block import notification stream.
    let pubsub_notification_sinks: fc_mapping_sync::EthereumBlockNotificationSinks<
        fc_mapping_sync::EthereumBlockNotification<Block>,
    > = Default::default();
    let pubsub_notification_sinks = Arc::new(pubsub_notification_sinks);

    spawn_frontier_tasks(
        &task_manager,
        FrontierTasksParams {
            client: client.clone(),
            backend: backend.clone(),
            frontier_backend: frontier_backend.clone(),
            frontier_partial_components: FrontierPartialComponents {
                filter_pool: filter_pool.clone(),
                fee_history_cache: fee_history_cache.clone(),
                fee_history_cache_limit,
            },
            storage_override,
            sync: sync_service.clone(),
            pubsub_notification_sinks,
        },
    )
    .await;

    let base_path = config.base_path.path().to_path_buf().clone();

    let rpc_extensions_builder = {
        let client = client.clone();
        let pool = transaction_pool.clone();
        let backend = backend.clone();
        let frontier_backend = frontier_backend.clone();
        let network = network.clone();
        let max_past_logs = eth_config.max_past_logs;
        let overrides = overrides.clone();
        let fee_history_cache = fee_history_cache.clone();
        let block_data_cache = block_data_cache.clone();
        let fee_history_limit = eth_config.fee_history_limit;
        let sync = sync_service.clone();

        Box::new(move |subscription_executor| {
            let deps = crate::rpc::FullDeps {
                client: client.clone(),
                pool: pool.clone(),
                graph: pool.pool().clone(),
                beefy: BeefyDeps::<BeefyId> {
                    beefy_finality_proof_stream: beefy_rpc_links.from_voter_justif_stream.clone(),
                    beefy_best_block_stream: beefy_rpc_links.from_voter_best_beefy_stream.clone(),
                    subscription_executor,
                },
                max_past_logs,
                fee_history_limit,
                fee_history_cache: fee_history_cache.clone(),
                network: Arc::new(network.clone()),
                sync: sync.clone(),
                filter_pool: filter_pool.clone(),
                block_data_cache: block_data_cache.clone(),
                overrides: overrides.clone(),
                is_authority: is_authority.clone(),
                command_sink: command_sink.clone(),
                backend: backend.clone(),
                frontier_backend: match &*frontier_backend {
                    fc_db::Backend::KeyValue(b) => b.clone(),
                    fc_db::Backend::Sql(b) => b.clone(),
                },
                forced_parent_hashes: None,
                maybe_storage_hub_client_config: maybe_storage_hub_client_rpc_config.clone(),
            };
            crate::rpc::create_full(deps).map_err(Into::into)
        })
    };

    let rpc_handlers = sc_service::spawn_tasks(sc_service::SpawnTasksParams {
        network: Arc::new(network.clone()),
        client: client.clone(),
        keystore: keystore_container.keystore(),
        task_manager: &mut task_manager,
        transaction_pool: transaction_pool.clone(),
        rpc_builder: rpc_extensions_builder,
        backend: backend.clone(),
        system_rpc_tx,
        tx_handler_controller,
        sync_service: sync_service.clone(),
        config,
        telemetry: telemetry.as_mut(),
    })?;

    if is_authority {
        if let Some(mode) = sealing {
            let proposer_factory = sc_basic_authorship::ProposerFactory::new(
                task_manager.spawn_handle(),
                client.clone(),
                transaction_pool.clone(),
                prometheus_registry.as_ref(),
                telemetry.as_ref().map(|x| x.handle()),
            );

            let slot_duration = babe_link.config().slot_duration();
            let epoch_changes = babe_link.epoch_changes().clone();
            let authorities = babe_link.config().authorities.clone();
            let keystore = keystore_container.keystore();
            let client_for_consensus = client.clone();
            let consensus_data_provider = move || {
                BabeConsensusDataProvider::new(
                    client_for_consensus.clone(),
                    keystore.clone(),
                    epoch_changes.clone(),
                    authorities.clone(),
                )
                .map(|provider| Box::new(provider) as _)
                .map_err(|e| ServiceError::Other(e.to_string()))
            };

            let create_inherent_data_providers = move |_, ()| {
                std::future::ready(Ok::<_, Box<dyn std::error::Error + Send + Sync>>(
                    build_babe_inherent_providers(slot_duration, true),
                ))
            };

            match mode {
                Sealing::Manual => {
                    let commands_stream = manual_commands_stream.take().ok_or_else(|| {
                        ServiceError::Other(
                            "Manual sealing requested but command channel is unavailable".into(),
                        )
                    })?;

                    let future = sc_consensus_manual_seal::run_manual_seal(ManualSealParams {
                        block_import,
                        env: proposer_factory,
                        client: client.clone(),
                        pool: transaction_pool.clone(),
                        commands_stream,
                        select_chain,
                        consensus_data_provider: Some(consensus_data_provider()?),
                        create_inherent_data_providers,
                    });

                    task_manager.spawn_essential_handle().spawn_blocking(
                        "manual-seal",
                        Some("block-authoring"),
                        future,
                    );
                }
                Sealing::Instant => {
                    let future = sc_consensus_manual_seal::run_instant_seal(InstantSealParams {
                        block_import,
                        env: proposer_factory,
                        client: client.clone(),
                        pool: transaction_pool.clone(),
                        select_chain,
                        consensus_data_provider: Some(consensus_data_provider()?),
                        create_inherent_data_providers,
                    });

                    task_manager.spawn_essential_handle().spawn_blocking(
                        "manual-seal",
                        Some("block-authoring"),
                        future,
                    );
                }
            }

            log::info!("Manual sealing enabled (mode: {:?})", mode);
        } else {
            let proposer_factory = sc_basic_authorship::ProposerFactory::new(
                task_manager.spawn_handle(),
                client.clone(),
                transaction_pool.clone(),
                prometheus_registry.as_ref(),
                telemetry.as_ref().map(|x| x.handle()),
            );

            let slot_duration = babe_link.clone().config().slot_duration();
            let create_inherent_data_providers = move |_, ()| {
                std::future::ready(Ok::<_, Box<dyn std::error::Error + Send + Sync>>(
                    build_babe_inherent_providers(slot_duration, false),
                ))
            };
            let babe_config = sc_consensus_babe::BabeParams {
                keystore: keystore_container.keystore(),
                client: client.clone(),
                select_chain,
                env: proposer_factory,
                block_import,
                sync_oracle: sync_service.clone(),
                justification_sync_link: sync_service.clone(),
                create_inherent_data_providers,
                force_authoring,
                backoff_authoring_blocks,
                babe_link,
                block_proposal_slot_portion: sc_consensus_babe::SlotProportion::new(0.5),
                max_block_proposal_slot_portion: None,
                telemetry: telemetry.as_ref().map(|x| x.handle()),
            };

            let babe = sc_consensus_babe::start_babe(babe_config)?;
            task_manager.spawn_essential_handle().spawn_blocking(
                "babe-proposer",
                Some("block-authoring"),
                babe,
            );
        }
    }

    if enable_grandpa {
        // if the node isn't actively participating in consensus then it doesn't
        // need a keystore, regardless of which protocol we use below.
        let keystore = if role.is_authority() {
            Some(keystore_container.keystore())
        } else {
            None
        };

        let grandpa_config = sc_consensus_grandpa::Config {
            // FIXME #1578 make this available through chainspec
            gossip_duration: Duration::from_millis(333),
            justification_generation_period: GRANDPA_JUSTIFICATION_PERIOD,
            name: Some(name),
            observer_enabled: false,
            keystore,
            local_role: role,
            telemetry: telemetry.as_ref().map(|x| x.handle()),
            protocol_name: grandpa_protocol_name,
        };

        // start the full GRANDPA voter
        // NOTE: non-authorities could run the GRANDPA observer protocol, but at
        // this point the full voter should provide better guarantees of block
        // and vote data availability than the observer. The observer has not
        // been tested extensively yet and having most nodes in a network run it
        // could lead to finality stalls.
        let grandpa_config = sc_consensus_grandpa::GrandpaParams {
            config: grandpa_config,
            link: grandpa_link,
            network: network.clone(),
            sync: Arc::new(sync_service.clone()),
            notification_service: grandpa_notification_service,
            voting_rule: sc_consensus_grandpa::VotingRulesBuilder::default().build(),
            prometheus_registry: prometheus_registry.clone(),
            shared_voter_state: SharedVoterState::empty(),
            telemetry: telemetry.as_ref().map(|x| x.handle()),
            offchain_tx_pool_factory: OffchainTransactionPoolFactory::new(transaction_pool),
        };

        // the GRANDPA voter task is considered infallible, i.e.
        // if it fails we take down the service with it.
        task_manager.spawn_essential_handle().spawn_blocking(
            "grandpa-voter",
            None,
            sc_consensus_grandpa::run_grandpa_voter(grandpa_config)?,
        );
    }
    // if the node isn't actively participating in consensus then it doesn't
    // need a keystore, regardless of which protocol we use below.
    let keystore_opt = if role.is_authority() {
        Some(keystore_container.keystore())
    } else {
        None
    };

    // beefy is enabled if its notification service exists
    if sealing.is_none() {
        if let Some(notification_service) = beefy_notification_service {
            let justifications_protocol_name =
                beefy_on_demand_justifications_handler.protocol_name();
            let network_params = sc_consensus_beefy::BeefyNetworkParams {
                network: Arc::new(network.clone()),
                sync: sync_service.clone(),
                gossip_protocol_name: beefy_gossip_proto_name,
                justifications_protocol_name,
                notification_service,
                _phantom: core::marker::PhantomData::<Block>,
            };
            let payload_provider = sp_consensus_beefy::mmr::MmrRootProvider::new(client.clone());
            let beefy_params = sc_consensus_beefy::BeefyParams {
                client: client.clone(),
                backend: backend.clone(),
                payload_provider,
                runtime: client.clone(),
                key_store: keystore_opt.clone(),
                network_params,
                min_block_delta: 8,
                prometheus_registry: prometheus_registry.clone(),
                links: beefy_voter_links,
                on_demand_justifications_handler: beefy_on_demand_justifications_handler,
                is_authority: role.is_authority(),
            };

            let gadget = sc_consensus_beefy::start_beefy_gadget::<_, _, _, _, _, _, _, BeefyId>(
                beefy_params,
            );

            // BEEFY is part of consensus, if it fails we'll bring the node down with it to make
            // sure it is noticed.
            task_manager
                .spawn_essential_handle()
                .spawn_blocking("beefy-gadget", None, gadget);
        }
    }

    if let Some(_) = role_options {
        finish_sh_builder_and_run_tasks(
            sh_builder.expect("StorageHubBuilder should already be initialised."),
            client.clone(),
            rpc_handlers.clone(),
            keystore_container.keystore(),
            base_path.clone(),
            false,
        )
        .await?;
    }

    network_starter.start_network();
    Ok(task_manager)
}

pub async fn new_full<
    Runtime,
    RuntimeApi,
    N: sc_network::NetworkBackend<Block, <Block as sp_runtime::traits::Block>::Hash>,
>(
    config: Configuration,
    eth_config: EthConfiguration,
    role_options: Option<RoleOptions>,
    indexer_options: Option<IndexerOptions>,
    sealing: Option<Sealing>,
) -> Result<TaskManager, ServiceError>
where
    Runtime: shc_common::traits::StorageEnableRuntime<RuntimeApi = RuntimeApi>,
    RuntimeApi: sp_api::ConstructRuntimeApi<Block, FullClient<RuntimeApi>> + Send + Sync + 'static,
    RuntimeApi::RuntimeApi: FullRuntimeApi,
{
    if let Some(role_options) = role_options {
        match role_options {
            RoleOptions::Provider(ProviderOptions {
                provider_type: ProviderType::Bsp,
                storage_layer: StorageLayer::Memory,
                ..
            }) => {
                return new_full_impl::<BspProvider, InMemoryStorageLayer, Runtime, RuntimeApi, N>(
                    config,
                    eth_config,
                    Some(role_options),
                    indexer_options,
                    sealing,
                )
                .await;
            }
            RoleOptions::Provider(ProviderOptions {
                provider_type: ProviderType::Bsp,
                storage_layer: StorageLayer::RocksDB,
                ..
            }) => {
                return new_full_impl::<BspProvider, RocksDbStorageLayer, Runtime, RuntimeApi, N>(
                    config,
                    eth_config,
                    Some(role_options),
                    indexer_options,
                    sealing,
                )
                .await;
            }
            RoleOptions::Provider(ProviderOptions {
                provider_type: ProviderType::Msp,
                storage_layer: StorageLayer::Memory,
                ..
            }) => {
                return new_full_impl::<MspProvider, InMemoryStorageLayer, Runtime, RuntimeApi, N>(
                    config,
                    eth_config,
                    Some(role_options),
                    indexer_options,
                    sealing,
                )
                .await;
            }
            RoleOptions::Provider(ProviderOptions {
                provider_type: ProviderType::Msp,
                storage_layer: StorageLayer::RocksDB,
                ..
            }) => {
                return new_full_impl::<MspProvider, RocksDbStorageLayer, Runtime, RuntimeApi, N>(
                    config,
                    eth_config,
                    Some(role_options),
                    indexer_options,
                    sealing,
                )
                .await;
            }
            RoleOptions::Fisherman(FishermanOptions { .. }) => {
                return new_full_impl::<FishermanRole, NoStorageLayer, Runtime, RuntimeApi, N>(
                    config,
                    eth_config,
                    Some(role_options),
                    indexer_options,
                    sealing,
                )
                .await;
            }
        };
    } else {
        return new_full_impl::<UserRole, NoStorageLayer, Runtime, RuntimeApi, N>(
            config,
            eth_config,
            None,
            indexer_options,
            sealing,
        )
        .await;
    };
}

//╔═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
//║                                   StorageHub Client Setup Utilities                                           ║
//╚═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝

/// Helper function to setup database pool
async fn setup_database_pool(database_url: String) -> Result<DbPool, sc_service::Error> {
    shc_indexer_db::setup_db_pool(database_url)
        .await
        .map_err(|e| sc_service::Error::Application(Box::new(e)))
}

/// Configure and spawn the indexer service.
async fn configure_and_spawn_indexer<Runtime: StorageEnableRuntime>(
    indexer_options: &Option<IndexerOptions>,
    task_manager: &TaskManager,
    client: Arc<StorageEnableClient<Runtime>>,
) -> Result<(), sc_service::Error> {
    let indexer_options = match indexer_options {
        Some(config) => config,
        None => return Ok(()),
    };

    // Setup database pool
    let db_pool = setup_database_pool(indexer_options.database_url.clone()).await?;

    info!(
        "📊 Starting Indexer service (mode: {:?})",
        indexer_options.indexer_mode
    );

    let task_spawner = TaskSpawner::new(task_manager.spawn_handle(), "indexer-service");
    spawn_indexer_service::<Runtime>(
        &task_spawner,
        client.clone(),
        db_pool.clone(),
        indexer_options.indexer_mode,
    )
    .await;

    Ok(())
}
/// Initialize the StorageHub builder with configured services based on the node's role.
///
/// If `indexer_options` is provided, spawns the indexer service regardless of role configuration.
/// The indexer service is decoupled from the role system and can run standalone.
///
/// Returns `None` if no role is configured (e.g., standalone indexer mode).
async fn init_sh_builder<R, S, Runtime: StorageEnableRuntime>(
    role_options: &Option<RoleOptions>,
    indexer_options: &Option<IndexerOptions>,
    task_manager: &TaskManager,
    file_transfer_request_protocol: Option<(ProtocolName, Receiver<IncomingRequest>)>,
    network: Arc<dyn NetworkService>,
    keystore: KeystorePtr,
    client: Arc<StorageEnableClient<Runtime>>,
) -> Result<
    Option<(
        StorageHubBuilder<R, S, Runtime>,
        StorageHubClientRpcConfig<
            <(R, S) as ShNodeType<Runtime>>::FL,
            <(R, S) as ShNodeType<Runtime>>::FSH,
            Runtime,
        >,
    )>,
    sc_service::Error,
>
where
    R: ShRole,
    S: ShStorageLayer,
    (R, S): ShNodeType<Runtime>,
    StorageHubBuilder<R, S, Runtime>: StorageLayerBuilder,
{
    // Spawn indexer service if enabled. Runs before role check to allow standalone operation.
    configure_and_spawn_indexer::<Runtime>(&indexer_options, &task_manager, client.clone()).await?;

    let role_options = match role_options {
        Some(role) => role,
        None => return Ok(None),
    };

    let task_spawner_name = match role_options {
        RoleOptions::Provider(ProviderOptions {
            provider_type: ProviderType::Msp,
            ..
        }) => "msp-service",
        RoleOptions::Provider(ProviderOptions {
            provider_type: ProviderType::Bsp,
            ..
        }) => "bsp-service",
        RoleOptions::Fisherman(_) => "fisherman-service",
    };
    let task_spawner = TaskSpawner::new(task_manager.spawn_handle(), task_spawner_name);
    let mut builder = StorageHubBuilder::<R, S, Runtime>::new(task_spawner);

    // Setup file transfer service (common to all roles)
    let (file_transfer_request_protocol_name, file_transfer_request_receiver) =
        file_transfer_request_protocol
            .expect("FileTransfer request protocol should already be initialised.");

    builder
        .with_file_transfer(
            file_transfer_request_receiver,
            file_transfer_request_protocol_name,
            network.clone(),
        )
        .await;

    // Role-specific configuration
    let rpc_config = match role_options {
        RoleOptions::Provider(ProviderOptions {
            rpc_config,
            provider_type,
            storage_path,
            max_storage_capacity,
            jump_capacity,
            msp_charging_period,
            msp_charge_fees,
            msp_move_bucket,
            bsp_upload_file,
            bsp_move_bucket,
            bsp_charge_fees,
            bsp_submit_proof,
            blockchain_service,
            msp_database_url,
            max_open_forests,
            ..
        }) => {
            info!(
                "Starting as a Storage Provider. Storage path: {:?}, Max storage capacity: {:?}, Jump capacity: {:?}, MSP charging period: {:?}",
                storage_path, max_storage_capacity, jump_capacity, msp_charging_period,
            );

            // Setup the storage layer and capacity config
            builder
                .setup_storage_layer(storage_path.clone(), max_open_forests.unwrap_or(512))
                .with_capacity_config(Some(CapacityConfig::new(
                    max_storage_capacity.unwrap_or_default().saturated_into(),
                    jump_capacity.unwrap_or_default().saturated_into(),
                )));

            // Configure provider-specific options
            builder.with_msp_charge_fees_config(msp_charge_fees.clone());
            builder.with_msp_move_bucket_config(msp_move_bucket.clone());
            builder.with_bsp_upload_file_config(bsp_upload_file.clone());
            builder.with_bsp_move_bucket_config(bsp_move_bucket.clone());
            builder.with_bsp_charge_fees_config(bsp_charge_fees.clone());
            builder.with_bsp_submit_proof_config(bsp_submit_proof.clone());

            // MSP-specific configuration
            if *provider_type == ProviderType::Msp {
                builder.with_notify_period(*msp_charging_period);

                // MSPs can optionally have database access to execute move bucket operations.
                if let Some(db_url) = msp_database_url {
                    info!("Setting up MSP database connection: {}", db_url);
                    let msp_db_pool = setup_database_pool(db_url.clone()).await?;
                    builder.with_indexer_db_pool(Some(msp_db_pool));
                }
            }

            if let Some(c) = blockchain_service {
                let peer_id = network.local_peer_id().to_bytes();
                let mut c = c.clone();
                c.peer_id = Some(peer_id);
                builder.with_blockchain_service_config(c);
            }

            rpc_config.clone()
        }
        RoleOptions::Fisherman(fisherman_options) => {
            // Validate configuration compatibility with indexer
            if let Some(indexer_cfg) = indexer_options {
                if indexer_cfg.indexer_mode == shc_indexer_service::IndexerMode::Lite {
                    return Err(sc_service::Error::Other(
                        "Fisherman service cannot run with 'lite' indexer mode. Please use either 'full' or 'fishing' mode."
                            .to_string(),
                    ));
                }
            }

            // Setup database pool for fisherman
            let db_pool = setup_database_pool(fisherman_options.database_url.clone()).await?;

            info!(
                "🎣 Starting as a Fisherman. Database URL: {}",
                fisherman_options.database_url
            );

            // Setup the storage layer (ephemeral for fisherman)
            builder.setup_storage_layer(None, 0);

            // Set the indexer db pool
            builder.with_indexer_db_pool(Some(db_pool));

            // Spawn the fisherman service
            builder
                .with_fisherman(client.clone(), &fisherman_options)
                .await;

            RpcConfig::default()
        }
    };

    // Create RPC configuration
    let storage_hub_client_rpc_config = builder.create_rpc_config(keystore, rpc_config);

    Ok(Some((builder, storage_hub_client_rpc_config)))
}

/// Finish the StorageHubBuilder and run the tasks.
async fn finish_sh_builder_and_run_tasks<R, S, Runtime: StorageEnableRuntime>(
    mut sh_builder: StorageHubBuilder<R, S, Runtime>,
    client: Arc<StorageEnableClient<Runtime>>,
    rpc_handlers: RpcHandlers,
    keystore: KeystorePtr,
    rocksdb_root_path: impl Into<PathBuf>,
    maintenance_mode: bool,
) -> Result<(), sc_service::Error>
where
    R: ShRole,
    S: ShStorageLayer,
    (R, S): ShNodeType<Runtime>,
    StorageHubBuilder<R, S, Runtime>: StorageLayerBuilder + Buildable<(R, S), Runtime>,
    StorageHubHandler<(R, S), Runtime>: RunnableTasks,
{
    let rocks_db_path = rocksdb_root_path.into();

    // Spawn the Blockchain Service if node is running as a Storage Provider
    sh_builder
        .with_blockchain(
            client.clone(),
            keystore.clone(),
            Arc::new(rpc_handlers),
            rocks_db_path.clone(),
            maintenance_mode,
        )
        .await;

    // Initialize the BSP peer manager
    sh_builder.with_peer_manager(rocks_db_path.clone());

    // Build the StorageHubHandler
    let mut sh_handler = sh_builder.build();

    // Run StorageHub tasks according to the node role
    sh_handler.run_tasks().await;

    Ok(())
}
