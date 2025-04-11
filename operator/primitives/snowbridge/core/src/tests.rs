use crate::{ChannelId, ParaId};
use hex_literal::hex;

const EXPECT_CHANNEL_ID: [u8; 32] =
	hex!("c173fac324158e77fb5840738a1a541f633cbec8884c6a601c567d2b376a0539");

// The Solidity equivalent code is tested in Gateway.t.sol:testDeriveChannelID
#[test]
fn generate_channel_id() {
	let para_id: ParaId = 1000.into();
	let channel_id: ChannelId = para_id.into();
	assert_eq!(channel_id, EXPECT_CHANNEL_ID.into());
}
