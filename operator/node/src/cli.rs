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

use crate::command::ProviderOptions;
use crate::eth::EthConfiguration;
use clap::{Parser, ValueEnum};
use sc_cli::RunCmd;
use serde::Deserializer;
use shc_client::builder::{
    BlockchainServiceOptions, BspChargeFeesOptions, BspMoveBucketOptions, BspSubmitProofOptions,
    BspUploadFileOptions, FishermanOptions, IndexerOptions, MspChargeFeesOptions,
    MspMoveBucketOptions,
};
use shc_indexer_service::IndexerMode;
use shc_rpc::RpcConfig;
use shp_types::StorageDataUnit;

// Available Sealing methods.
#[derive(Copy, Clone, Debug, Default, ValueEnum)]
pub enum Sealing {
    /// Seal using rpc method.
    #[default]
    Manual,
    /// Seal when transaction is executed.
    Instant,
}

#[derive(Debug, Parser)]
pub struct Cli {
    #[command(subcommand)]
    pub subcommand: Option<Subcommand>,

    #[allow(missing_docs)]
    #[command(flatten)]
    pub run: RunCmd,

    /// Choose sealing method.
    #[arg(long, value_enum, ignore_case = true)]
    pub sealing: Option<Sealing>,

    #[command(flatten)]
    pub eth: EthConfiguration,

    /// Provider configurations
    #[command(flatten)]
    pub provider_config: ProviderConfigurations,

    /// Provider configurations file path (allow to specify the provider configuration in a file instead of the cli)
    #[arg(long, conflicts_with_all = [
        "provider", "provider_type", "max_storage_capacity", "jump_capacity",
        "storage_layer", "storage_path", "extrinsic_retry_timeout",
        "check_for_pending_proofs_period",
        "msp_charging_period", "msp_charge_fees_task", "msp_charge_fees_min_debt",
        "msp_move_bucket_task", "msp_move_bucket_max_try_count", "msp_move_bucket_max_tip",
        "bsp_upload_file_task", "bsp_upload_file_max_try_count", "bsp_upload_file_max_tip",
        "bsp_move_bucket_task", "bsp_move_bucket_grace_period",
        "bsp_charge_fees_task", "bsp_charge_fees_min_debt",
        "bsp_submit_proof_task", "bsp_submit_proof_max_attempts",
        "pending_db_url",
        "fisherman", "fisherman_database_url", 
        "trusted_file_transfer_server", "trusted_file_transfer_server_host", "trusted_file_transfer_server_port",
    ])]
    pub provider_config_file: Option<String>,

    /// Indexer configurations
    #[command(flatten)]
    pub indexer_config: IndexerConfigurations,

    /// Fisherman configurations
    #[command(flatten)]
    pub fisherman_config: FishermanConfigurations,
}

#[derive(Debug, clap::Subcommand)]
#[allow(clippy::large_enum_variant)]
pub enum Subcommand {
    /// Key management cli utilities
    #[command(subcommand)]
    Key(sc_cli::KeySubcommand),

    /// Build a chain specification.
    BuildSpec(sc_cli::BuildSpecCmd),

    /// Validate blocks.
    CheckBlock(sc_cli::CheckBlockCmd),

    /// Export blocks.
    ExportBlocks(sc_cli::ExportBlocksCmd),

    /// Export the state of a given block into a chain spec.
    ExportState(sc_cli::ExportStateCmd),

    /// Import blocks.
    ImportBlocks(sc_cli::ImportBlocksCmd),

    /// Remove the whole chain.
    PurgeChain(sc_cli::PurgeChainCmd),

    /// Revert the chain to a previous state.
    Revert(sc_cli::RevertCmd),

    /// Sub-commands concerned with benchmarking.
    #[cfg(feature = "runtime-benchmarks")]
    #[command(subcommand)]
    Benchmark(frame_benchmarking_cli::BenchmarkCmd),

    /// Db meta columns information.
    ChainInfo(sc_cli::ChainInfoCmd),
}

#[derive(ValueEnum, Clone, Debug, Eq, PartialEq)]
pub enum ProviderType {
    /// Main Storage Provider
    Msp,
    /// Backup Storage Provider
    Bsp,
}

impl<'de> serde::Deserialize<'de> for ProviderType {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        let s = String::deserialize(d)?;

        let provider_type = match s.as_str() {
            "bsp" => ProviderType::Bsp,
            "msp" => ProviderType::Msp,
            _ => {
                return Err(serde::de::Error::custom(
                    "Cannot parse `provider_type`. Invalid value.",
                ))
            }
        };

        Ok(provider_type)
    }
}

#[derive(ValueEnum, Clone, Debug)]
pub enum StorageLayer {
    /// RocksDB with path.
    RocksDB,
    /// In Memory
    Memory,
}

impl<'de> serde::Deserialize<'de> for StorageLayer {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        let s = String::deserialize(d)?;

        let storage_layer = match s.as_str() {
            "rocksdb" => StorageLayer::RocksDB,
            "memory" => StorageLayer::Memory,
            _ => {
                return Err(serde::de::Error::custom(
                    "Cannot parse `storage_type`. Invalid value.",
                ))
            }
        };

        Ok(storage_layer)
    }
}

#[derive(Debug, Parser)]
#[group(skip)]
pub struct ProviderConfigurations {
    /// Run node as a StorageHub provider.
    #[arg(long)]
    pub provider: bool,

    /// Run the node in maintenance mode.
    /// In this mode, the node will not import blocks or participate in consensus,
    /// but will allow specific RPC calls for file and storage management.
    #[arg(long, default_value = "false")]
    pub maintenance_mode: bool,

    /// Type of StorageHub provider.
    #[arg(
        long,
        value_enum,
        value_name = "PROVIDER_TYPE",
        required_if_eq("provider", "true")
    )]
    pub provider_type: Option<ProviderType>,

    /// Maximum storage capacity of the provider (bytes).
    #[arg(long, required_if_eq_all([
        ("provider", "true"),
        ("provider_type", "msp"),
    ]), required_if_eq_all([
        ("provider", "true"),
        ("provider_type", "bsp"),
    ]))]
    pub max_storage_capacity: Option<StorageDataUnit>,

    /// Jump capacity (bytes).
    #[arg(long, required_if_eq_all([
        ("provider", "true"),
        ("provider_type", "msp"),
    ]), required_if_eq_all([
        ("provider", "true"),
        ("provider_type", "bsp"),
    ]))]
    pub jump_capacity: Option<StorageDataUnit>,

    /// Type of StorageHub provider.
    /// Currently: `memory` and `rocks-db`.
    #[arg(
        long,
        value_enum,
        value_name = "STORAGE_LAYER",
        default_value = "memory"
    )]
    pub storage_layer: Option<StorageLayer>,

    /// Storage location in the file system
    #[arg(long, required_if_eq("storage_layer", "rocks-db"))]
    pub storage_path: Option<String>,

    /// Extrinsic retry timeout in seconds.
    #[arg(long, default_value = "60")]
    pub extrinsic_retry_timeout: Option<u64>,

    /// On blocks that are multiples of this number, the blockchain service will trigger the catch of proofs.
    #[arg(long, default_value = "4")]
    pub check_for_pending_proofs_period: Option<u32>,

    /// Enable MSP file distribution to BSPs (disabled by default unless set via config/CLI).
    /// Only applicable when running as an MSP provider.
    #[arg(long, value_name = "BOOLEAN")]
    pub msp_distribute_files: bool,

    /// Postgres database URL for persisting pending extrinsics (Blockchain Service DB).
    /// If not provided, the service will use the `SH_PENDING_DB_URL` environment variable.
    /// If neither is set, pending transactions will not be persisted.
    #[arg(long("pending-db-url"), env = "SH_PENDING_DB_URL")]
    pub pending_db_url: Option<String>,

    // ============== Provider RPC options ==============
    // ============== Remote file upload/download options ==============
    /// Maximum file size in bytes (default: 10GB)
    #[arg(
        long,
        value_name = "BYTES",
        help_heading = "RPC - Remote File Options",
        default_value = "10737418240"
    )]
    pub max_file_size: Option<u64>,

    /// Connection timeout in seconds (default: 30)
    #[arg(long, value_name = "SECONDS", default_value = "30")]
    pub connection_timeout: Option<u64>,

    /// Read timeout in seconds (default: 300)
    #[arg(long, value_name = "SECONDS", default_value = "300")]
    pub read_timeout: Option<u64>,

    /// Whether to follow redirects (default: true)
    #[arg(long, value_name = "BOOLEAN", default_value = "true")]
    pub follow_redirects: Option<bool>,

    /// Maximum number of redirects (default: 10)
    #[arg(long, value_name = "COUNT", default_value = "10")]
    pub max_redirects: Option<u64>,

    /// User agent string (default: "StorageHub-Client/1.0")
    #[arg(long, value_name = "STRING", default_value = "StorageHub-Client/1.0")]
    pub user_agent: Option<String>,

    /// Chunk size in bytes. This is different from the FILE_CHUNK_SIZE constant in the runtime, as it only affects file upload/download. (default: 8KB)
    #[arg(long, value_name = "BYTES", default_value = "8192")]
    pub chunk_size: Option<u64>,

    /// Number of `chunk_size` chunks to buffer during upload/download. (default: 512)
    #[arg(long, value_name = "COUNT", default_value = "512")]
    pub chunks_buffer: Option<u64>,

    /// The number of 1KB (FILE_CHUNK_SIZE) chunks we batch and queue from the db while
    /// transferring the file on a save_file_to_disk call.
    #[arg(long, value_name = "COUNT", default_value = "1024")]
    pub internal_buffer_size: Option<u64>,

    // ============== MSP Charge Fees task options ==============
    /// Enable and configure MSP Charge Fees task.
    #[arg(long)]
    pub msp_charge_fees_task: bool,

    /// Minimum debt threshold for charging users.
    #[arg(
        long,
        value_name = "AMOUNT",
        help_heading = "MSP Charge Fees Options",
        required_if_eq_all([
            ("msp_charge_fees_task", "true"),
            ("provider_type", "msp"),
        ])
    )]
    pub msp_charge_fees_min_debt: Option<u64>,

    /// MSP charging fees period (in blocks).
    /// Setting it to 600 with a block every 6 seconds will charge user every hour.
    #[arg(long, required_if_eq_all([
        ("provider", "true"),
        ("provider_type", "msp"),
    ]))]
    pub msp_charging_period: Option<u32>,

    // ============== MSP Move Bucket task options ==============
    /// Enable and configure MSP Move Bucket task.
    #[arg(long)]
    pub msp_move_bucket_task: bool,

    /// Maximum number of times to retry a move bucket request.
    #[arg(
        long,
        value_name = "COUNT",
        help_heading = "MSP Move Bucket Options",
        required_if_eq_all([
            ("msp_move_bucket_task", "true"),
            ("provider_type", "msp"),
        ])
    )]
    pub msp_move_bucket_max_try_count: Option<u32>,

    /// Maximum tip amount to use when submitting a move bucket request extrinsic.
    #[arg(
        long,
        value_name = "AMOUNT",
        help_heading = "MSP Move Bucket Options",
        required_if_eq_all([
            ("msp_move_bucket_task", "true"),
            ("provider_type", "msp"),
        ])
    )]
    pub msp_move_bucket_max_tip: Option<u128>,

    // ============== BSP Upload File task options ==============
    /// Enable and configure BSP Upload File task.
    #[arg(long)]
    pub bsp_upload_file_task: bool,

    /// Maximum number of times to retry an upload file request.
    #[arg(
        long,
        value_name = "COUNT",
        help_heading = "BSP Upload File Options",
        required_if_eq_all([
            ("bsp_upload_file_task", "true"),
            ("provider_type", "bsp"),
        ])
    )]
    pub bsp_upload_file_max_try_count: Option<u32>,

    /// Maximum tip amount to use when submitting an upload file request extrinsic.
    #[arg(
        long,
        value_name = "AMOUNT",
        help_heading = "BSP Upload File Options",
        required_if_eq_all([
            ("bsp_upload_file_task", "true"),
            ("provider_type", "bsp"),
        ])
    )]
    pub bsp_upload_file_max_tip: Option<u128>,

    // ============== BSP Move Bucket task options ==============
    /// Enable and configure BSP Move Bucket task.
    #[arg(long)]
    pub bsp_move_bucket_task: bool,

    /// Grace period in seconds to accept download requests after a bucket move is accepted.
    #[arg(
        long,
        value_name = "SECONDS",
        help_heading = "BSP Move Bucket Options",
        required_if_eq_all([
            ("bsp_move_bucket_task", "true"),
            ("provider_type", "bsp"),
        ])
    )]
    pub bsp_move_bucket_grace_period: Option<u64>,

    // ============== BSP Charge Fees task options ==============
    /// Enable and configure BSP Charge Fees task.
    #[arg(long)]
    pub bsp_charge_fees_task: bool,

    /// Minimum debt threshold for charging users.
    #[arg(
        long,
        value_name = "AMOUNT",
        help_heading = "BSP Charge Fees Options",
        required_if_eq_all([
            ("bsp_charge_fees_task", "true"),
            ("provider_type", "bsp"),
        ])
    )]
    pub bsp_charge_fees_min_debt: Option<u64>,

    // ============== BSP Submit Proof task options ==============
    /// Enable and configure BSP Submit Proof task.
    #[arg(long)]
    pub bsp_submit_proof_task: bool,

    /// Maximum number of attempts to submit a proof.
    #[arg(
        long,
        value_name = "COUNT",
        help_heading = "BSP Submit Proof Options",
        required_if_eq_all([
            ("bsp_submit_proof_task", "true"),
            ("provider_type", "bsp"),
        ])
    )]
    pub bsp_submit_proof_max_attempts: Option<u32>,

    /// Optional database URL for MSP nodes only. If provided, enables database access
    /// for operations such as move bucket operations without requiring the full indexer service.
    #[arg(
        long,
        value_name = "DATABASE_URL",
        help_heading = "MSP Database Options"
    )]
    pub msp_database_url: Option<String>,

    /// Enable the trusted file transfer HTTP server
    #[arg(
        long,
        value_name = "BOOLEAN",
        help_heading = "Trusted File Transfer Server Options"
    )]
    pub trusted_file_transfer_server: bool,

    /// Host address for trusted file transfer HTTP server (default: 127.0.0.1).
    #[arg(
        long,
        value_name = "HOST",
        help_heading = "Trusted File Transfer Server Options",
        default_value = "127.0.0.1"
    )]
    pub trusted_file_transfer_server_host: Option<String>,

    /// Port for trusted file transfer HTTP server (default: 7070).
    #[arg(
        long,
        value_name = "PORT",
        help_heading = "Trusted File Transfer Server Options",
        default_value = "7070"
    )]
    pub trusted_file_transfer_server_port: Option<u16>,
}

impl ProviderConfigurations {
    pub fn provider_options(&self) -> ProviderOptions {
        // Configure RPC options for Provider
        let mut rpc_config = RpcConfig::default();
        if let Some(max_file_size) = self.max_file_size {
            rpc_config.remote_file.max_file_size = max_file_size;
        }
        if let Some(connection_timeout) = self.connection_timeout {
            rpc_config.remote_file.connection_timeout = connection_timeout;
        }
        if let Some(read_timeout) = self.read_timeout {
            rpc_config.remote_file.read_timeout = read_timeout;
        }
        if let Some(follow_redirects) = self.follow_redirects {
            rpc_config.remote_file.follow_redirects = follow_redirects;
        }
        if let Some(max_redirects) = self.max_redirects {
            rpc_config.remote_file.max_redirects = max_redirects;
        }
        if let Some(user_agent) = self.user_agent.clone() {
            rpc_config.remote_file.user_agent = user_agent;
        }
        if let Some(chunk_size) = self.chunk_size {
            if chunk_size > 0 {
                rpc_config.remote_file.chunk_size = chunk_size as usize;
            }
        }
        if let Some(chunks_buffer) = self.chunks_buffer {
            if chunks_buffer > 0 {
                rpc_config.remote_file.chunks_buffer = chunks_buffer as usize;
            }
        }
        if let Some(internal_buffer_size) = self.internal_buffer_size {
            if internal_buffer_size > 0 {
                rpc_config.remote_file.internal_buffer_size = internal_buffer_size as usize;
            }
        }

        // Get provider type to conditionally apply options
        let provider_type = self
            .provider_type
            .clone()
            .expect("Provider type is required");

        let mut msp_charge_fees = None;
        let mut msp_move_bucket = None;
        let mut bsp_upload_file = None;
        let mut bsp_move_bucket = None;
        let mut bsp_charge_fees = None;
        let mut bsp_submit_proof = None;

        // Only set MSP options if provider_type is MSP
        if provider_type == ProviderType::Msp {
            // If specific task flags are enabled, use the provided options
            if self.msp_charge_fees_task {
                let mut options = MspChargeFeesOptions::default();
                options.min_debt = self.msp_charge_fees_min_debt;
                msp_charge_fees = Some(options);
            }

            if self.msp_move_bucket_task {
                let mut options = MspMoveBucketOptions::default();
                options.max_try_count = self.msp_move_bucket_max_try_count;
                options.max_tip = self.msp_move_bucket_max_tip;
                msp_move_bucket = Some(options);
            }
        }

        // Only set BSP options if provider_type is BSP
        if provider_type == ProviderType::Bsp {
            if self.bsp_upload_file_task {
                let mut options = BspUploadFileOptions::default();
                options.max_try_count = self.bsp_upload_file_max_try_count;
                options.max_tip = self.bsp_upload_file_max_tip;
                bsp_upload_file = Some(options);
            }

            if self.bsp_move_bucket_task {
                let mut options = BspMoveBucketOptions::default();
                options.move_bucket_accepted_grace_period = self.bsp_move_bucket_grace_period;
                bsp_move_bucket = Some(options);
            }

            if self.bsp_charge_fees_task {
                let mut options = BspChargeFeesOptions::default();
                options.min_debt = self.bsp_charge_fees_min_debt;
                bsp_charge_fees = Some(options);
            }

            if self.bsp_submit_proof_task {
                let mut options = BspSubmitProofOptions::default();
                options.max_submission_attempts = self.bsp_submit_proof_max_attempts;
                bsp_submit_proof = Some(options);
            }
        }

        // Configure blockchain service options
        let mut blockchain_service = None;
        let mut bs_options = BlockchainServiceOptions::default();
        let mut bs_changed = false;

        if let Some(extrinsic_retry_timeout) = self.extrinsic_retry_timeout {
            bs_options.extrinsic_retry_timeout = Some(extrinsic_retry_timeout);
            bs_changed = true;
        }

        // Set MSP distribution flag if provided on CLI and role is MSP
        if self.msp_distribute_files && provider_type == ProviderType::Msp {
            bs_options.enable_msp_distribute_files = Some(true);
            bs_changed = true;
        }

        // If a pending DB URL was provided, enable blockchain service options and pass it through
        if let Some(url) = self.pending_db_url.clone() {
            bs_options.pending_db_url = Some(url);
            bs_changed = true;
        }

        if let Some(check_for_pending_proofs_period) = self.check_for_pending_proofs_period {
            bs_options.check_for_pending_proofs_period = Some(check_for_pending_proofs_period);
            bs_changed = true;
        }

        // Set MSP distribution flag if provided on CLI and role is MSP
        if self.msp_distribute_files && provider_type == ProviderType::Msp {
            bs_options.enable_msp_distribute_files = Some(true);
            bs_changed = true;
        }

        if bs_changed {
            blockchain_service = Some(bs_options);
        }

        ProviderOptions {
            provider_type,
            storage_layer: self
                .storage_layer
                .clone()
                .expect("Storage layer is required"),
            storage_path: self.storage_path.clone(),
            max_storage_capacity: self.max_storage_capacity,
            jump_capacity: self.jump_capacity,
            rpc_config: rpc_config,
            msp_charging_period: self.msp_charging_period,
            msp_charge_fees,
            msp_move_bucket,
            bsp_upload_file,
            bsp_move_bucket,
            bsp_charge_fees,
            bsp_submit_proof,
            blockchain_service,
            msp_database_url: self.msp_database_url.clone(),
            trusted_file_transfer_server: self.trusted_file_transfer_server,
            trusted_file_transfer_server_host: self.trusted_file_transfer_server_host.clone(),
            trusted_file_transfer_server_port: self.trusted_file_transfer_server_port,
            // We don't support maintenance mode for now.
            // maintenance_mode: self.maintenance_mode,
        }
    }
}

#[derive(Debug, Parser, Clone)]
pub struct IndexerConfigurations {
    /// Enable the indexer service.
    #[arg(long)]
    pub indexer: bool,

    /// The mode in which the indexer runs.
    ///
    /// - `full`: Indexes all blockchain data
    /// - `lite`: Indexes only essential data for storage operations
    /// - `fishing`: Indexes only essential data for operating as a fisherman
    #[arg(long, value_parser = clap::value_parser!(IndexerMode), default_value = "full")]
    pub indexer_mode: IndexerMode,

    /// Postgres database URL.
    ///
    /// If not provided, the indexer will use the `INDEXER_DATABASE_URL` environment variable. If the
    /// environment variable is not set, the node will abort.
    #[arg(
        long("indexer-database-url"),
        env = "INDEXER_DATABASE_URL",
        required_if_eq("indexer", "true")
    )]
    pub indexer_database_url: Option<String>,
}

impl IndexerConfigurations {
    pub fn indexer_options(&self) -> Option<IndexerOptions> {
        if self.indexer {
            Some(IndexerOptions {
                indexer_mode: self.indexer_mode,
                database_url: self
                    .indexer_database_url
                    .clone()
                    .expect("Indexer database URL is required"),
            })
        } else {
            None
        }
    }
}

#[derive(Debug, Parser, Clone)]
pub struct FishermanConfigurations {
    /// Enable the fisherman service.
    #[arg(long, conflicts_with = "provider")]
    pub fisherman: bool,

    /// Postgres database URL for the fisherman service.
    ///
    /// If not provided, the fisherman will use the `FISHERMAN_DATABASE_URL` environment variable.
    /// If the environment variable is not set, the node will abort.
    #[arg(
        long("fisherman-database-url"),
        env = "FISHERMAN_DATABASE_URL",
        required_if_eq("fisherman", "true")
    )]
    pub fisherman_database_url: Option<String>,

    /// Duration between batch deletion processing cycles (in seconds).
    #[arg(long, default_value = "60", value_parser = clap::value_parser!(u64).range(1..))]
    pub fisherman_batch_interval_seconds: u64,

    /// Maximum number of files to process per batch deletion cycle.
    #[arg(long, default_value = "1000", value_parser = clap::value_parser!(u64).range(1..))]
    pub fisherman_batch_deletion_limit: u64,
}

impl FishermanConfigurations {
    pub fn fisherman_options(&self) -> Option<FishermanOptions> {
        if self.fisherman {
            Some(FishermanOptions {
                database_url: self
                    .fisherman_database_url
                    .clone()
                    .expect("Fisherman database URL is required"),
                batch_interval_seconds: self.fisherman_batch_interval_seconds,
                batch_deletion_limit: self.fisherman_batch_deletion_limit,
                maintenance_mode: false, // Skipping maintenance mode for now
            })
        } else {
            None
        }
    }
}
