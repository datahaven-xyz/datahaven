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

use sc_consensus_babe::CompatibleDigestItem;
use sp_inherents::InherentData;
use sp_runtime::{generic::Digest, traits::Block as BlockT, DigestItem};

/// Implement pending consensus data provider for BABE.
#[derive(Default)]
pub struct BabeConsensusDataProvider {}

impl BabeConsensusDataProvider {
    /// Creates a new instance of the [`BabeConsensusDataProvider`]
    pub fn new() -> Self {
        Self {}
    }
}

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
