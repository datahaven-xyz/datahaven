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

use std::sync::Arc;

#[cfg(feature = "runtime-benchmarks")]
use crate::benchmarking::{inherent_benchmark_data, RemarkBuilder, TransferKeepAliveBuilder};
use crate::config;
use crate::service::frontier_database_dir;
use crate::{
    chain_spec::{self, NetworkType},
    cli::{Cli, ProviderType, StorageLayer, Subcommand},
    service,
};
use datahaven_runtime_common::Block;
#[cfg(feature = "runtime-benchmarks")]
use frame_benchmarking_cli::{BenchmarkCmd, ExtrinsicFactory, SUBSTRATE_REFERENCE_HARDWARE};
use sc_cli::SubstrateCli;
use sc_service::{ChainType, DatabaseSource};
use serde::Deserialize;
use shc_client::builder::{
    BlockchainServiceOptions, BspChargeFeesOptions, BspMoveBucketOptions, BspSubmitProofOptions,
    BspUploadFileOptions, FishermanOptions, MspChargeFeesOptions, MspMoveBucketOptions,
};
use shc_rpc::RpcConfig;
use shp_types::StorageDataUnit;

/// Configuration for the provider.
#[derive(Debug, Clone, Deserialize)]
pub struct ProviderOptions {
    /// Provider type.
    pub provider_type: ProviderType,
    /// Storage layer.
    pub storage_layer: StorageLayer,
    /// RocksDB Path.
    pub storage_path: Option<String>,
    /// Maximum storage capacity of the Storage Provider (bytes).
    pub max_storage_capacity: Option<StorageDataUnit>,
    /// Jump capacity (bytes).
    pub jump_capacity: Option<StorageDataUnit>,
    /// RPC configuration options.
    #[serde(default)]
    pub rpc_config: RpcConfig,
    /// MSP charging fees frequency.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub msp_charging_period: Option<u32>,
    /// Configuration options for MSP charge fees task.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub msp_charge_fees: Option<MspChargeFeesOptions>,
    /// Configuration options for MSP move bucket task.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub msp_move_bucket: Option<MspMoveBucketOptions>,
    /// Configuration options for BSP upload file task.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bsp_upload_file: Option<BspUploadFileOptions>,
    /// Configuration options for BSP move bucket task.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bsp_move_bucket: Option<BspMoveBucketOptions>,
    /// Configuration options for BSP charge fees task.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bsp_charge_fees: Option<BspChargeFeesOptions>,
    /// Configuration options for BSP submit proof task.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bsp_submit_proof: Option<BspSubmitProofOptions>,
    /// Configuration options for blockchain service.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub blockchain_service: Option<BlockchainServiceOptions>,
    /// MSP database URL.
    pub msp_database_url: Option<String>,
    // Whether the node is running in maintenance mode. We are not supporting maintenance mode.
    // pub maintenance_mode: bool,
}

/// Role configuration enum that ensures mutual exclusivity between Provider and Fisherman roles.
#[derive(Debug, Clone)]
pub enum RoleOptions {
    /// Storage Provider configuration
    Provider(ProviderOptions),
    /// Fisherman configuration
    Fisherman(FishermanOptions),
}

impl SubstrateCli for Cli {
    fn impl_name() -> String {
        "DataHaven Node".into()
    }

    fn impl_version() -> String {
        env!("SUBSTRATE_CLI_IMPL_VERSION").into()
    }

    fn description() -> String {
        env!("CARGO_PKG_DESCRIPTION").into()
    }

    fn author() -> String {
        env!("CARGO_PKG_AUTHORS").into()
    }

    fn support_url() -> String {
        "https://github.com/datahaven-xyz/datahaven/issues/new".into()
    }

    fn copyright_start_year() -> i32 {
        2025
    }

    fn load_spec(&self, id: &str) -> Result<Box<dyn sc_service::ChainSpec>, String> {
        Ok(match id {
            "dev" | "stagenet-dev" => Box::new(chain_spec::stagenet::development_chain_spec()?),
            "" | "local" | "stagenet-local" => Box::new(chain_spec::stagenet::local_chain_spec()?),
            "testnet-dev" => Box::new(chain_spec::testnet::development_chain_spec()?),
            "testnet-local" => Box::new(chain_spec::testnet::local_chain_spec()?),
            "mainnet-dev" => Box::new(chain_spec::mainnet::development_chain_spec()?),
            "mainnet-local" => Box::new(chain_spec::mainnet::local_chain_spec()?),
            path => Box::new(chain_spec::ChainSpec::from_json_file(
                std::path::PathBuf::from(path),
            )?),
        })
    }
}

macro_rules! construct_async_run {
	(|$components:ident, $cli:ident, $cmd:ident, $config:ident| $( $code:tt )* ) => {{
		let runner = $cli.create_runner($cmd)?;
		match runner.config().chain_spec {
			ref spec if spec.is_mainnet() => {
				runner.async_run(|$config| {
					let $components = service::new_partial::<datahaven_mainnet_runtime::Runtime, datahaven_mainnet_runtime::RuntimeApi>(
						&$config,
                        &mut $cli.eth.clone(),
                        false,
					)?;
					let task_manager = $components.task_manager;
					{ $( $code )* }.map(|v| (v, task_manager))
				})
			}
            ref spec if spec.is_testnet() => {
                runner.async_run(|$config| {
					let $components = service::new_partial::<datahaven_testnet_runtime::Runtime, datahaven_testnet_runtime::RuntimeApi>(
						&$config,
                        &mut $cli.eth.clone(),
                        false,
					)?;
					let task_manager = $components.task_manager;
					{ $( $code )* }.map(|v| (v, task_manager))
				})
            }
			_ => {
				runner.async_run(|$config| {
					let $components = service::new_partial::<datahaven_stagenet_runtime::Runtime, datahaven_stagenet_runtime::RuntimeApi>(
						&$config,
                        &mut $cli.eth.clone(),
                        false,
					)?;
					let task_manager = $components.task_manager;
					{ $( $code )* }.map(|v| (v, task_manager))
				})
			}
		}
	}}
}

#[cfg(feature = "runtime-benchmarks")]
macro_rules! construct_benchmark_partials {
    ($cli:expr, $config:expr, |$partials:ident| $code:expr) => {
        match $config.chain_spec {
            ref spec if spec.is_mainnet() => {
                let $partials = service::new_partial::<
                    datahaven_mainnet_runtime::Runtime,
                    datahaven_mainnet_runtime::RuntimeApi,
                >(&$config, &mut $cli.eth.clone(), false)?;
                $code
            }
            ref spec if spec.is_testnet() => {
                let $partials = service::new_partial::<
                    datahaven_testnet_runtime::Runtime,
                    datahaven_testnet_runtime::RuntimeApi,
                >(&$config, &mut $cli.eth.clone(), false)?;
                $code
            }
            _ => {
                let $partials = service::new_partial::<
                    datahaven_stagenet_runtime::Runtime,
                    datahaven_stagenet_runtime::RuntimeApi,
                >(&$config, &mut $cli.eth.clone(), false)?;
                $code
            }
        }
    };
}

/// Parse and run command line arguments
pub fn run() -> sc_cli::Result<()> {
    let cli = Cli::from_args();

    match &cli.subcommand {
        Some(Subcommand::Key(cmd)) => cmd.run(&cli),
        Some(Subcommand::BuildSpec(cmd)) => {
            let runner = cli.create_runner(cmd)?;
            runner.sync_run(|config| cmd.run(config.chain_spec, config.network))
        }
        Some(Subcommand::CheckBlock(cmd)) => {
            construct_async_run!(|components, cli, cmd, config| {
                Ok(cmd.run(components.client, components.import_queue))
            })
        }
        Some(Subcommand::ExportBlocks(cmd)) => {
            construct_async_run!(|components, cli, cmd, config| {
                Ok(cmd.run(components.client, config.database))
            })
        }
        Some(Subcommand::ExportState(cmd)) => {
            construct_async_run!(|components, cli, cmd, config| {
                Ok(cmd.run(components.client, config.chain_spec))
            })
        }
        Some(Subcommand::ImportBlocks(cmd)) => {
            construct_async_run!(|components, cli, cmd, config| {
                Ok(cmd.run(components.client, components.import_queue))
            })
        }
        Some(Subcommand::PurgeChain(cmd)) => {
            let runner = cli.create_runner(cmd)?;
            runner.sync_run(|config| {
                // Remove Frontier offchain db
                let frontier_database_config = match config.database {
                    DatabaseSource::RocksDb { .. } => DatabaseSource::RocksDb {
                        path: frontier_database_dir(&config, "db"),
                        cache_size: 0,
                    },
                    DatabaseSource::ParityDb { .. } => DatabaseSource::ParityDb {
                        path: frontier_database_dir(&config, "paritydb"),
                    },
                    _ => {
                        return Err(format!("Cannot purge `{:?}` database", config.database).into())
                    }
                };
                cmd.run(frontier_database_config)
            })
        }
        Some(Subcommand::Revert(cmd)) => {
            construct_async_run!(|components, cli, cmd, config| {
                let aux_revert =
                    Box::new(|client: Arc<service::FullClient<_>>, backend, blocks| {
                        sc_consensus_babe::revert(client.clone(), backend, blocks)?;
                        sc_consensus_grandpa::revert(client, blocks)?;
                        Ok(())
                    });
                Ok(cmd.run(components.client, components.backend, Some(aux_revert)))
            })
        }
        #[cfg(feature = "runtime-benchmarks")]
        Some(Subcommand::Benchmark(cmd)) => {
            let runner = cli.create_runner(cmd)?;

            runner.sync_run(|config| {
                // This switch needs to be in the client, since the client decides
                // which sub-commands it wants to support.
                match cmd {
                    BenchmarkCmd::Pallet(cmd) => cmd
                        .run_with_spec::<sp_runtime::traits::HashingFor<Block>, ()>(Some(
                            config.chain_spec,
                        )),
                    BenchmarkCmd::Block(cmd) => {
                        construct_benchmark_partials!(cli, config, |partials| cmd
                            .run(partials.client))
                    }
                    BenchmarkCmd::Storage(cmd) => {
                        construct_benchmark_partials!(cli, config, |partials| {
                            let db = partials.backend.expose_db();
                            let storage = partials.backend.expose_storage();

                            cmd.run(config, partials.client.clone(), db, storage)
                        })
                    }
                    BenchmarkCmd::Overhead(cmd) => {
                        construct_benchmark_partials!(cli, config, |partials| {
                            let ext_builder = RemarkBuilder::new(partials.client.clone());
                            cmd.run(
                                config.chain_spec.name().to_string(),
                                partials.client,
                                inherent_benchmark_data()?,
                                Vec::new(),
                                &ext_builder,
                                false,
                            )
                        })
                    }
                    BenchmarkCmd::Extrinsic(cmd) => {
                        construct_benchmark_partials!(cli, config, |partials| {
                            // Register the *Remark* and *TKA* builders.
                            let ext_factory = ExtrinsicFactory(vec![
                                Box::new(RemarkBuilder::new(partials.client.clone())),
                                Box::new(TransferKeepAliveBuilder::new(
                                    partials.client.clone(),
                                    datahaven_stagenet_runtime::genesis_config_presets::alith(),
                                    // Assume the existential deposit is the same for all runtimes
                                    datahaven_stagenet_runtime::ExistentialDeposit::get(),
                                )),
                            ]);

                            cmd.run(
                                partials.client,
                                inherent_benchmark_data()?,
                                Vec::new(),
                                &ext_factory,
                            )
                        })
                    }
                    BenchmarkCmd::Machine(cmd) => {
                        cmd.run(&config, SUBSTRATE_REFERENCE_HARDWARE.clone())
                    }
                }
            })
        }
        Some(Subcommand::ChainInfo(cmd)) => {
            let runner = cli.create_runner(cmd)?;
            runner.sync_run(|config| cmd.run::<Block>(&config))
        }
        None => {
            let mut role_options = None;
            let mut indexer_options = None;
            let runner = cli.create_runner(&cli.run)?;

            // If we have a provider config file
            if let Some(provider_config_file) = cli.provider_config_file {
                let config = config::read_config(&provider_config_file);
                if let Some(c) = config {
                    // Check for mutual exclusivity in config file
                    let has_provider = matches!(
                        c.provider.provider_type,
                        ProviderType::Bsp | ProviderType::Msp
                    );
                    let has_fisherman = !c.fisherman.database_url.is_empty();

                    if has_provider && has_fisherman {
                        return Err("Cannot configure both provider and fisherman in the same config file. Please choose one role.".into());
                    }

                    if has_provider {
                        let provider = c.provider;
                        role_options = Some(RoleOptions::Provider(provider));
                    } else if has_fisherman {
                        let fisherman = c.fisherman;
                        role_options = Some(RoleOptions::Fisherman(fisherman));
                    }

                    indexer_options = Some(c.indexer);
                };
            };

            if cli.provider_config.provider && cli.fisherman_config.fisherman {
                return Err(
                    "Cannot run as a fisherman and a provider at the same time. Please choose one role."
                        .into(),
                );
            }

            if cli.provider_config.provider {
                role_options = Some(RoleOptions::Provider(
                    cli.provider_config.provider_options(),
                ));
            };

            if cli.indexer_config.indexer {
                indexer_options = cli.indexer_config.indexer_options();
            };

            if cli.fisherman_config.fisherman {
                role_options = Some(RoleOptions::Fisherman(
                    cli.fisherman_config
                        .fisherman_options()
                        .expect("Clap/TOML configurations should prevent this from ever failing"),
                ));
            };

            runner.run_node_until_exit(|config| async move {
                let sealing_mode = match (cli.sealing, config.chain_spec.chain_type()) {
                    (Some(mode), ChainType::Development) => Some(mode),
                    (Some(_), _) => {
                        log::warn!(
                            "`--sealing` is only supported on development chains; ignoring."
                        );
                        None
                    }
                    (None, _) => None,
                };

                match config.network.network_backend {
                    // TODO: Litep2p becomes standard with Polkadot SDK stable2412-7 (should move None to other arm)
                    // cfr. https://github.com/paritytech/polkadot-sdk/releases/tag/polkadot-stable2412-7
                    Some(sc_network::config::NetworkBackendType::Libp2p) | None => {
                        match config.chain_spec {
                            ref spec if spec.is_mainnet() => {
                                service::new_full::<
                                    datahaven_mainnet_runtime::Runtime,
                                    datahaven_mainnet_runtime::RuntimeApi,
                                    sc_network::NetworkWorker<_, _>,
                                >(
                                    config, cli.eth, role_options, indexer_options, sealing_mode
                                )
                                .await
                            }
                            ref spec if spec.is_testnet() => {
                                service::new_full::<
                                    datahaven_testnet_runtime::Runtime,
                                    datahaven_testnet_runtime::RuntimeApi,
                                    sc_network::NetworkWorker<_, _>,
                                >(
                                    config, cli.eth, role_options, indexer_options, sealing_mode
                                )
                                .await
                            }
                            _ => {
                                service::new_full::<
                                    datahaven_stagenet_runtime::Runtime,
                                    datahaven_stagenet_runtime::RuntimeApi,
                                    sc_network::NetworkWorker<_, _>,
                                >(
                                    config, cli.eth, role_options, indexer_options, sealing_mode
                                )
                                .await
                            }
                        }
                        .map_err(sc_cli::Error::Service)
                    }
                    Some(sc_network::config::NetworkBackendType::Litep2p) => {
                        match config.chain_spec {
                            ref spec if spec.is_mainnet() => {
                                service::new_full::<
                                    datahaven_mainnet_runtime::Runtime,
                                    datahaven_mainnet_runtime::RuntimeApi,
                                    sc_network::Litep2pNetworkBackend,
                                >(
                                    config, cli.eth, role_options, indexer_options, sealing_mode
                                )
                                .await
                            }
                            ref spec if spec.is_testnet() => {
                                service::new_full::<
                                    datahaven_testnet_runtime::Runtime,
                                    datahaven_testnet_runtime::RuntimeApi,
                                    sc_network::Litep2pNetworkBackend,
                                >(
                                    config, cli.eth, role_options, indexer_options, sealing_mode
                                )
                                .await
                            }
                            _ => {
                                service::new_full::<
                                    datahaven_stagenet_runtime::Runtime,
                                    datahaven_stagenet_runtime::RuntimeApi,
                                    sc_network::Litep2pNetworkBackend,
                                >(
                                    config, cli.eth, role_options, indexer_options, sealing_mode
                                )
                                .await
                            }
                        }
                        .map_err(sc_cli::Error::Service)
                    }
                }
            })
        }
    }
}
