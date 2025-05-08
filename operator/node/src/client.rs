use crate::eth::EthCompatRuntimeApiCollection;
use codec::Codec;
// Substrate
use datahaven_runtime_common::{AccountId, Nonce};
use sc_executor::WasmExecutor;
use sp_runtime::traits::{Block as BlockT, MaybeDisplay};

/// Full backend.
pub type FullBackend<B> = sc_service::TFullBackend<B>;
/// Full client.
pub type FullClient<B, RA, HF> = sc_service::TFullClient<B, RA, WasmExecutor<HF>>;

/// A set of APIs that every runtime must implement.
pub trait _BaseRuntimeApiCollection<Block: BlockT>:
    sp_api::ApiExt<Block>
    + sp_api::Metadata<Block>
    + sp_block_builder::BlockBuilder<Block>
    + sp_offchain::OffchainWorkerApi<Block>
    + sp_session::SessionKeys<Block>
    + sp_transaction_pool::runtime_api::TaggedTransactionQueue<Block>
{
}

impl<Block, Api> _BaseRuntimeApiCollection<Block> for Api
where
    Block: BlockT,
    Api: sp_api::ApiExt<Block>
        + sp_api::Metadata<Block>
        + sp_block_builder::BlockBuilder<Block>
        + sp_offchain::OffchainWorkerApi<Block>
        + sp_session::SessionKeys<Block>
        + sp_transaction_pool::runtime_api::TaggedTransactionQueue<Block>,
{
}

/// A set of APIs that template runtime must implement.
pub trait _RuntimeApiCollection<Block: BlockT, Balance: Codec + MaybeDisplay>:
    _BaseRuntimeApiCollection<Block>
    + EthCompatRuntimeApiCollection<Block>
    + sp_consensus_babe::BabeApi<Block>
    + sp_consensus_grandpa::GrandpaApi<Block>
    + frame_system_rpc_runtime_api::AccountNonceApi<Block, AccountId, Nonce>
    + pallet_transaction_payment_rpc_runtime_api::TransactionPaymentApi<Block, Balance>
    + fp_rpc::ConvertTransactionRuntimeApi<Block>
    + fp_rpc::EthereumRuntimeRPCApi<Block>
{
}

impl<Block, Balance, Api> _RuntimeApiCollection<Block, Balance> for Api
where
    Block: BlockT,
    Balance: Codec + MaybeDisplay,
    Api: _BaseRuntimeApiCollection<Block>
        + EthCompatRuntimeApiCollection<Block>
        + sp_consensus_babe::BabeApi<Block>
        + sp_consensus_grandpa::GrandpaApi<Block>
        + frame_system_rpc_runtime_api::AccountNonceApi<Block, AccountId, Nonce>
        + pallet_transaction_payment_rpc_runtime_api::TransactionPaymentApi<Block, Balance>
        + fp_rpc::ConvertTransactionRuntimeApi<Block>
        + fp_rpc::EthereumRuntimeRPCApi<Block>,
{
}
