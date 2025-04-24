use sc_consensus_babe::CompatibleDigestItem;
use sp_inherents::InherentData;
use sp_runtime::{generic::Digest, traits::Block as BlockT, DigestItem};

/// Implement pending consensus data provider for BABE.
pub struct BabeConsensusDataProvider {}

impl<B> fc_rpc::pending::ConsensusDataProvider<B> for BabeConsensusDataProvider
where
    B: BlockT,
{
    fn create_digest(
        &self,
        parent: &B::Header,
        _data: &InherentData,
    ) -> Result<Digest, sp_inherents::Error> {
        let predigest = sc_consensus_babe::find_pre_digest::<B>(parent)
            .map_err(|e| sp_inherents::Error::Application(Box::new(e)))?;
        let digest = <DigestItem as CompatibleDigestItem>::babe_pre_digest(predigest);
        Ok(Digest { logs: vec![digest] })
    }
}

// Implement From trait for BabeConsensusDataProvider to Box<dyn ConsensusDataProvider<B>>
impl<B: BlockT> From<BabeConsensusDataProvider>
    for Box<dyn fc_rpc::pending::ConsensusDataProvider<B>>
{
    fn from(provider: BabeConsensusDataProvider) -> Self {
        Box::new(provider)
    }
}
