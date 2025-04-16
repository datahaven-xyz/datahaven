use std::sync::Arc;

use crate::service::frontier_database_dir;
use crate::{
    benchmarking::{inherent_benchmark_data, RemarkBuilder, TransferKeepAliveBuilder},
    chain_spec::{self, NetworkType},
    cli::{Cli, Subcommand},
    service,
};
use datahaven_runtime_common::Block;
use frame_benchmarking_cli::{BenchmarkCmd, ExtrinsicFactory, SUBSTRATE_REFERENCE_HARDWARE};
use sc_cli::SubstrateCli;
use sc_service::DatabaseSource;

impl SubstrateCli for Cli {
    fn impl_name() -> String {
        "Substrate Node".into()
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
        "support.anonymous.an".into()
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
					let $components = service::new_partial::<datahaven_mainnet_runtime::apis::RuntimeApi>(
						&$config,
                        &mut $cli.eth.clone()
					)?;
					let task_manager = $components.task_manager;
					{ $( $code )* }.map(|v| (v, task_manager))
				})
			}
            ref spec if spec.is_testnet() => {
                runner.async_run(|$config| {
					let $components = service::new_partial::<datahaven_testnet_runtime::apis::RuntimeApi>(
						&$config,
                        &mut $cli.eth.clone()
					)?;
					let task_manager = $components.task_manager;
					{ $( $code )* }.map(|v| (v, task_manager))
				})
            }
			_ => {
				runner.async_run(|$config| {
					let $components = service::new_partial::<datahaven_stagenet_runtime::apis::RuntimeApi>(
						&$config,
                        &mut $cli.eth.clone()
					)?;
					let task_manager = $components.task_manager;
					{ $( $code )* }.map(|v| (v, task_manager))
				})
			}
		}
	}}
}

macro_rules! construct_benchmark_partials {
    ($cli:expr, $config:expr, |$partials:ident| $code:expr) => {
        match $config.chain_spec {
            ref spec if spec.is_mainnet() => {
                let $partials =
                    service::new_partial::<datahaven_mainnet_runtime::apis::RuntimeApi>(&$config, &mut $cli.eth.clone())?;
                $code
            }
            ref spec if spec.is_testnet() => {
                let $partials =
                    service::new_partial::<datahaven_testnet_runtime::apis::RuntimeApi>(&$config, &mut $cli.eth.clone())?;
                $code
            }
            _ => {
                let $partials =
                    service::new_partial::<datahaven_stagenet_runtime::apis::RuntimeApi>(&$config, &mut $cli.eth.clone())?;
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
        Some(Subcommand::Benchmark(cmd)) => {
            let runner = cli.create_runner(cmd)?;

            runner.sync_run(|config| {
                // This switch needs to be in the client, since the client decides
                // which sub-commands it wants to support.
                match cmd {
                    BenchmarkCmd::Pallet(cmd) => {
                        if !cfg!(feature = "runtime-benchmarks") {
                            return Err(
                                "Runtime benchmarking wasn't enabled when building the node. \
            				You can enable it with `--features runtime-benchmarks`."
                                    .into(),
                            );
                        }

                        cmd.run_with_spec::<sp_runtime::traits::HashingFor<Block>, ()>(Some(
                            config.chain_spec,
                        ))
                    }
                    BenchmarkCmd::Block(cmd) => {
                        construct_benchmark_partials!(cli, config, |partials| cmd
                            .run(partials.client))
                    }
                    #[cfg(not(feature = "runtime-benchmarks"))]
                    BenchmarkCmd::Storage(_) => Err(
                        "Storage benchmarking can be enabled with `--features runtime-benchmarks`."
                            .into(),
                    ),
                    #[cfg(feature = "runtime-benchmarks")]
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
                                false
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
                                    datahaven_stagenet_runtime::EXISTENTIAL_DEPOSIT,
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
            let runner = cli.create_runner(&cli.run)?;
            runner.run_node_until_exit(|config| async move {
                match config.network.network_backend.unwrap_or_default() {
                    sc_network::config::NetworkBackendType::Libp2p => match config.chain_spec {
                        ref spec if spec.is_mainnet() => {
                            service::new_full::<
                                datahaven_mainnet_runtime::apis::RuntimeApi,
                                sc_network::NetworkWorker<_, _>,
                            >(config, cli.eth)
                            .await
                        }
                        ref spec if spec.is_testnet() => {
                            service::new_full::<
                                datahaven_testnet_runtime::apis::RuntimeApi,
                                sc_network::NetworkWorker<_, _>,
                            >(config, cli.eth)
                            .await
                        }
                        _ => {
                            service::new_full::<
                                datahaven_stagenet_runtime::apis::RuntimeApi,
                                sc_network::NetworkWorker<_, _>,
                            >(config, cli.eth)
                            .await
                        }
                    }
                    .map_err(sc_cli::Error::Service),
                    sc_network::config::NetworkBackendType::Litep2p => match config.chain_spec {
                        ref spec if spec.is_mainnet() => {
                            service::new_full::<
                                datahaven_mainnet_runtime::apis::RuntimeApi,
                                sc_network::Litep2pNetworkBackend,
                            >(config, cli.eth)
                            .await
                        }
                        ref spec if spec.is_testnet() => {
                            service::new_full::<
                                datahaven_testnet_runtime::apis::RuntimeApi,
                                sc_network::Litep2pNetworkBackend,
                            >(config, cli.eth)
                            .await
                        }
                        _ => {
                            service::new_full::<
                                datahaven_stagenet_runtime::apis::RuntimeApi,
                                sc_network::Litep2pNetworkBackend,
                            >(config, cli.eth)
                            .await
                        }
                    }
                    .map_err(sc_cli::Error::Service),
                }
            })
        }
    }
}
