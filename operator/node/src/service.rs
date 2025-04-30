//! Service and ServiceFactory implementation. Specialized wrapper over substrate service.

use crate::eth::{
    new_frontier_partial, spawn_frontier_tasks, BackendType, FrontierBackend,
    FrontierPartialComponents, FrontierTasksParams,
};
use crate::eth::{EthConfiguration, StorageOverrideHandler};
use crate::rpc::BeefyDeps;
use datahaven_runtime_common::{AccountId, Balance, Block, BlockNumber, Hash, Nonce};
use fc_consensus::FrontierBlockImport;
use fc_db::DatabaseSource;
use fc_storage::StorageOverride;
use futures::FutureExt;
use sc_client_api::{AuxStore, Backend, BlockBackend, StateBackend, StorageProvider};
use sc_consensus_babe::ImportQueueParams;
use sc_consensus_grandpa::SharedVoterState;
use sc_executor::{HeapAllocStrategy, WasmExecutor, DEFAULT_HEAP_ALLOC_STRATEGY};
use sc_service::{error::Error as ServiceError, Configuration, TaskManager, WarpSyncConfig};
use sc_telemetry::{Telemetry, TelemetryWorker};
use sc_transaction_pool::{BasicPool, FullChainApi};
use sc_transaction_pool_api::OffchainTransactionPoolFactory;
use sp_api::ProvideRuntimeApi;
use sp_blockchain::{Error as BlockChainError, HeaderBackend, HeaderMetadata};
use sp_consensus_beefy::ecdsa_crypto::AuthorityId as BeefyId;
use sp_runtime::traits::BlakeTwo256;
use std::{default::Default, path::Path, sync::Arc, time::Duration};

pub(crate) type FullClient<RuntimeApi> = sc_service::TFullClient<
    Block,
    RuntimeApi,
    sc_executor::WasmExecutor<sp_io::SubstrateHostFunctions>,
>;

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

type SingleStatePool<RuntimeApi> = BasicPool<FullChainApi<FullClient<RuntimeApi>, Block>, Block>;

/// The minimum period of blocks on which justifications will be
/// imported and generated.
const GRANDPA_JUSTIFICATION_PERIOD: u32 = 512;

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
    SingleStatePool<RuntimeApi>,
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

pub fn new_partial<RuntimeApi>(
    config: &Configuration,
    eth_config: &mut EthConfiguration,
) -> Result<Service<RuntimeApi>, ServiceError>
where
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
        create_inherent_data_providers: move |_, ()| async move {
            let timestamp = sp_timestamp::InherentDataProvider::from_system_time();

            let slot =
                    sp_consensus_babe::inherents::InherentDataProvider::from_timestamp_and_slot_duration(
                        *timestamp,
                        slot_duration,
                    );

            Ok((slot, timestamp))
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
        transaction_pool: transaction_pool.into(),
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
pub async fn new_full<
    RuntimeApi,
    N: sc_network::NetworkBackend<Block, <Block as sp_runtime::traits::Block>::Hash>,
>(
    config: Configuration,
    mut eth_config: EthConfiguration,
) -> Result<TaskManager, ServiceError>
where
    RuntimeApi: sp_api::ConstructRuntimeApi<Block, FullClient<RuntimeApi>> + Send + Sync + 'static,
    RuntimeApi::RuntimeApi: FullRuntimeApi,
{
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
    } = new_partial::<RuntimeApi>(&config, &mut eth_config)?;

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

    let role = config.role;
    let force_authoring = config.force_authoring;
    let backoff_authoring_blocks: Option<()> = None;
    let name = config.network.node_name.clone();
    let enable_grandpa = !config.disable_grandpa;
    let prometheus_registry = config.prometheus_registry().cloned();
    let overrides = Arc::new(StorageOverrideHandler::new(client.clone()));

    let block_data_cache = Arc::new(fc_rpc::EthBlockDataCacheTask::new(
        task_manager.spawn_handle(),
        overrides.clone(),
        eth_config.eth_log_block_cache,
        eth_config.eth_statuses_cache,
        prometheus_registry.clone(),
    ));

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
                fee_history_cache_limit: fee_history_cache_limit.clone(),
            },
            storage_override,
            sync: sync_service.clone(),
            pubsub_notification_sinks,
        },
    )
    .await;

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
                is_authority: false,
                command_sink: None,
                backend: backend.clone(),
                frontier_backend: match &*frontier_backend {
                    fc_db::Backend::KeyValue(b) => b.clone(),
                    fc_db::Backend::Sql(b) => b.clone(),
                },
                forced_parent_hashes: None,
            };
            crate::rpc::create_full(deps).map_err(Into::into)
        })
    };

    let _rpc_handlers = sc_service::spawn_tasks(sc_service::SpawnTasksParams {
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

    if role.is_authority() {
        let proposer_factory = sc_basic_authorship::ProposerFactory::new(
            task_manager.spawn_handle(),
            client.clone(),
            transaction_pool.clone(),
            prometheus_registry.as_ref(),
            telemetry.as_ref().map(|x| x.handle()),
        );

        let slot_duration = babe_link.clone().config().slot_duration();
        let babe_config = sc_consensus_babe::BabeParams {
            keystore: keystore_container.keystore(),
            client: client.clone(),
            select_chain,
            env: proposer_factory,
            block_import,
            sync_oracle: sync_service.clone(),
            justification_sync_link: sync_service.clone(),
            create_inherent_data_providers: move |_, ()| async move {
                let timestamp = sp_timestamp::InherentDataProvider::from_system_time();
                let slot =
                        sp_consensus_babe::inherents::InherentDataProvider::from_timestamp_and_slot_duration(
                            *timestamp,
                            slot_duration,
                        );
                Ok((slot, timestamp))
            },
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
    if let Some(notification_service) = beefy_notification_service {
        let justifications_protocol_name = beefy_on_demand_justifications_handler.protocol_name();
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

        let gadget =
            sc_consensus_beefy::start_beefy_gadget::<_, _, _, _, _, _, _, BeefyId>(beefy_params);

        // BEEFY is part of consensus, if it fails we'll bring the node down with it to make sure it
        // is noticed.
        task_manager
            .spawn_essential_handle()
            .spawn_blocking("beefy-gadget", None, gadget);
    }

    network_starter.start_network();
    Ok(task_manager)
}
