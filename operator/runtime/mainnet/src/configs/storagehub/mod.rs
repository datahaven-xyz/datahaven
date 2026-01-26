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

use super::{
    AccountId, Balance, Balances, BlockNumber, Hash, RuntimeEvent, RuntimeHoldReason,
    TreasuryAccount, HAVE,
};
use crate::configs::runtime_params::dynamic_params::runtime_config;
use crate::{
    BucketNfts, Nfts, PaymentStreams, ProofsDealer, Providers, Runtime, Signature, WeightToFee,
    HOURS,
};
use core::marker::PhantomData;
use datahaven_runtime_common::time::{DAYS, MINUTES};
use frame_support::pallet_prelude::DispatchClass;
use frame_support::traits::AsEnsureOriginWithArg;
use frame_support::{
    parameter_types,
    traits::{ConstU128, ConstU32, ConstU64, Randomness},
    weights::Weight,
};
use frame_system::pallet_prelude::BlockNumberFor;
use frame_system::{EnsureRoot, EnsureSigned};
use num_bigint::BigUint;
use pallet_nfts::PalletFeatures;
use polkadot_runtime_common::prod_or_fast;
use shp_data_price_updater::{MostlyStablePriceIndexUpdater, MostlyStablePriceIndexUpdaterConfig};
use shp_file_key_verifier::FileKeyVerifier;
use shp_file_metadata::{ChunkId, FileMetadata};
use shp_forest_verifier::ForestVerifier;
use shp_treasury_funding::{
    LinearThenPowerOfTwoTreasuryCutCalculator, LinearThenPowerOfTwoTreasuryCutCalculatorConfig,
};
use sp_core::Get;
use sp_core::Hasher;
use sp_core::H256;
use sp_runtime::traits::Convert;
use sp_runtime::traits::ConvertBack;
use sp_runtime::traits::Verify;
use sp_runtime::traits::Zero;
use sp_runtime::SaturatedConversion;
use sp_runtime::{traits::BlakeTwo256, Perbill};
use sp_std::convert::{From, Into};
use sp_std::{vec, vec::Vec};
use sp_trie::{LayoutV1, TrieConfiguration, TrieLayout};

#[cfg(feature = "std")]
pub mod client; // StorageHub client trait only build for std build

/// Type representing the storage data units in StorageHub.
pub type StorageDataUnit = u64;

pub type StorageProofsMerkleTrieLayout = LayoutV1<BlakeTwo256>;

pub type Hashing = BlakeTwo256;

/****** NFTs pallet ******/
parameter_types! {
    pub const CollectionDeposit: Balance = 100 * HAVE;
    pub const ItemDeposit: Balance = 1 * HAVE;
    pub const MetadataDepositBase: Balance = 10 * HAVE;
    pub const MetadataDepositPerByte: Balance = 1 * HAVE;
    pub const ApprovalsLimit: u32 = 20;
    pub const ItemAttributesApprovalsLimit: u32 = 20;
    pub const MaxTips: u32 = 10;
    pub const MaxDeadlineDuration: BlockNumber = 12 * 30 * DAYS;
    pub const MaxAttributesPerCall: u32 = 10;
    pub Features: PalletFeatures = PalletFeatures::all_enabled();
}

impl pallet_nfts::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type CollectionId = u32;
    type ItemId = u32;
    type Currency = Balances;
    type CreateOrigin = AsEnsureOriginWithArg<EnsureSigned<AccountId>>;
    type ForceOrigin = frame_system::EnsureRoot<AccountId>;
    type CollectionDeposit = CollectionDeposit;
    type ItemDeposit = ItemDeposit;
    type MetadataDepositBase = MetadataDepositBase;
    type AttributeDepositBase = MetadataDepositBase;
    type DepositPerByte = MetadataDepositPerByte;
    type StringLimit = ConstU32<256>;
    type KeyLimit = ConstU32<64>;
    type ValueLimit = ConstU32<256>;
    type ApprovalsLimit = ApprovalsLimit;
    type ItemAttributesApprovalsLimit = ItemAttributesApprovalsLimit;
    type MaxTips = MaxTips;
    type MaxDeadlineDuration = MaxDeadlineDuration;
    type MaxAttributesPerCall = MaxAttributesPerCall;
    type Features = Features;
    type OffchainSignature = Signature;
    type OffchainPublic = <Signature as Verify>::Signer;
    type WeightInfo = crate::weights::pallet_nfts::WeightInfo<Runtime>;
    type Locker = ();
    #[cfg(feature = "runtime-benchmarks")]
    type Helper = benchmark_helpers::NftHelper;
}
/****** ****** ****** ******/

#[cfg(feature = "runtime-benchmarks")]
pub mod benchmark_helpers {
    use crate::{AccountId, Signature};
    use k256::ecdsa::SigningKey;
    use sp_runtime::traits::{IdentifyAccount, Verify};
    use sp_runtime::MultiSignature;

    const BENCH_SIGNING_KEY: [u8; 32] = [1u8; 32];

    fn bench_signing_key() -> SigningKey {
        SigningKey::from_bytes(&BENCH_SIGNING_KEY.into())
            .expect("benchmark signing key is valid; qed")
    }

    /// Benchmark helper for NFTs pallet
    pub struct NftHelper;

    impl pallet_nfts::BenchmarkHelper<u32, u32, <Signature as Verify>::Signer, AccountId, Signature>
        for NftHelper
    {
        fn collection(i: u16) -> u32 {
            i.into()
        }

        fn item(i: u16) -> u32 {
            i.into()
        }

        fn signer() -> (<Signature as Verify>::Signer, AccountId) {
            let signing_key = bench_signing_key();
            let verifying_key = signing_key.verifying_key();
            let encoded = verifying_key.to_encoded_point(true);
            let public =
                sp_core::ecdsa::Public::from_full(encoded.as_bytes()).expect("valid key; qed");
            let public_key: <Signature as Verify>::Signer = public.into();
            let account: AccountId = public_key.clone().into_account();
            (public_key, account)
        }

        fn sign(_public: &<Signature as Verify>::Signer, message: &[u8]) -> Signature {
            let digest = sp_io::hashing::keccak_256(message);
            let (sig, recovery_id) = bench_signing_key()
                .sign_prehash_recoverable(&digest)
                .expect("signing with fixed key never fails; qed");
            let mut sig_bytes = [0u8; 65];
            sig_bytes[..64].copy_from_slice(&sig.to_bytes());
            sig_bytes[64] = recovery_id.to_byte();
            let sig = sp_core::ecdsa::Signature::from_raw(sig_bytes);
            Signature::from(MultiSignature::Ecdsa(sig))
        }
    }
}

/****** Relay Randomness pallet ******/
impl pallet_randomness::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type BabeDataGetter = BabeDataGetter;
    type BabeBlockGetter = BlockNumberGetter;
    type WeightInfo = crate::weights::pallet_randomness::WeightInfo<Runtime>;
    type BabeDataGetterBlockNumber = BlockNumber;
}

pub struct BabeDataGetter;
impl pallet_randomness::GetBabeData<u64, Hash> for BabeDataGetter {
    fn get_epoch_index() -> u64 {
        pallet_babe::Pallet::<Runtime>::epoch_index()
    }
    fn get_epoch_randomness() -> Hash {
        // We use `RandomnessFromOneEpochAgo` implementation of the `Randomness` trait here, which hashes the `NextRandomness`
        // stored by the BABE pallet, and is valid for commitments until the last block of the last epoch (`_n`). The hashed
        // received is the hash of `NextRandomness` concatenated with the `subject` parameter provided (in this case empty).
        let (h, _n) = pallet_babe::RandomnessFromOneEpochAgo::<Runtime>::random(b"");
        h
    }
    fn get_parent_randomness() -> Hash {
        // We use `ParentBlockRandomness` implementation of the `Randomness` trait here, which hashes the `AuthorVrfRandomness`
        // stored by the BABE pallet, and is valid for commitments until the parent block (`_n`). The hashed received is the
        // hash of `AuthorVrfRandomness` concatenated with the `subject` parameter provided (in this case empty).
        let (h_opt, _n) = pallet_babe::ParentBlockRandomness::<Runtime>::random(b"");
        h_opt.unwrap_or_default()
    }
}

pub struct BlockNumberGetter {}
impl sp_runtime::traits::BlockNumberProvider for BlockNumberGetter {
    type BlockNumber = BlockNumber;

    fn current_block_number() -> Self::BlockNumber {
        frame_system::Pallet::<Runtime>::block_number()
    }
}

/****** ****** ****** ******/

/****** Storage Providers pallet ******/
parameter_types! {
    pub const SpMinDeposit: Balance = 100 * HAVE;
    pub const BucketDeposit: Balance = 100 * HAVE;
    pub const BspSignUpLockPeriod: BlockNumber = 90 * DAYS; // ~3 months
    pub const MaxBlocksForRandomness: BlockNumber = prod_or_fast!(2 * HOURS, 2 * MINUTES);
    // TODO: If the next line is uncommented (which should be eventually, replacing the line above), compilation breaks (most likely because of mismatched dependency issues)
    // pub const MaxBlocksForRandomness: BlockNumber = prod_or_fast!(2 * runtime_constants::time::EPOCH_DURATION_IN_SLOTS, 2 * MINUTES);
}

impl pallet_storage_providers::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type WeightInfo = pallet_storage_providers::weights::SubstrateWeight<Runtime>;
    type ProvidersRandomness = pallet_randomness::RandomnessFromOneEpochAgo<Runtime>;
    type PaymentStreams = PaymentStreams;
    type ProofDealer = ProofsDealer;
    type FileMetadataManager = FileMetadata<
        { shp_constants::H_LENGTH },
        { shp_constants::FILE_CHUNK_SIZE },
        { shp_constants::FILE_SIZE_TO_CHALLENGES },
    >;
    type NativeBalance = Balances;
    type CrRandomness = MockCrRandomness;
    type RuntimeHoldReason = RuntimeHoldReason;
    type StorageDataUnit = StorageDataUnit;
    type StorageDataUnitAndBalanceConvert = StorageDataUnitAndBalanceConverter;
    type SpCount = u32;
    type BucketCount = u128;
    type MerklePatriciaRoot = Hash;
    type MerkleTrieHashing = Hashing;
    type ProviderId = Hash;
    type ProviderIdHashing = Hashing;
    type ValuePropId = Hash;
    type ValuePropIdHashing = Hashing;
    type ReadAccessGroupId = <Self as pallet_nfts::Config>::CollectionId;
    type ProvidersProofSubmitters = ProofsDealer;
    type ReputationWeightType = u32;
    type StorageHubTickGetter = ProofsDealer;
    type Treasury = TreasuryAccount;
    type SpMinDeposit = SpMinDeposit;
    type SpMinCapacity = ConstU64<2>;
    type DepositPerData = ConstU128<2>;
    type MaxFileSize = ConstU64<{ u64::MAX }>;
    type MaxMultiAddressSize = ConstU32<200>;
    type MaxMultiAddressAmount = ConstU32<5>;
    type MaxProtocols = ConstU32<100>;
    type BucketDeposit = BucketDeposit;
    type BucketNameLimit = ConstU32<100>;
    type MaxBlocksForRandomness = MaxBlocksForRandomness;
    type MinBlocksBetweenCapacityChanges = ConstU32<10>;
    type DefaultMerkleRoot = DefaultMerkleRoot<StorageProofsMerkleTrieLayout>;
    type SlashAmountPerMaxFileSize = runtime_config::SlashAmountPerMaxFileSize;
    type StartingReputationWeight = ConstU32<1>;
    type BspSignUpLockPeriod = BspSignUpLockPeriod;
    type MaxCommitmentSize = ConstU32<1000>;
    type ZeroSizeBucketFixedRate = runtime_config::ZeroSizeBucketFixedRate;
    type ProviderTopUpTtl = runtime_config::ProviderTopUpTtl;
    type MaxExpiredItemsInBlock = ConstU32<100>;
}

pub struct StorageDataUnitAndBalanceConverter;
impl Convert<StorageDataUnit, Balance> for StorageDataUnitAndBalanceConverter {
    fn convert(data_unit: StorageDataUnit) -> Balance {
        data_unit.saturated_into()
    }
}
impl ConvertBack<StorageDataUnit, Balance> for StorageDataUnitAndBalanceConverter {
    fn convert_back(balance: Balance) -> StorageDataUnit {
        balance.saturated_into()
    }
}

pub type HasherOutT<T> = <<T as TrieLayout>::Hash as Hasher>::Out;
pub struct DefaultMerkleRoot<T>(PhantomData<T>);
impl<T: TrieConfiguration> Get<HasherOutT<T>> for DefaultMerkleRoot<T> {
    fn get() -> HasherOutT<T> {
        sp_trie::empty_trie_root::<T>()
    }
}

/****** ****** ****** ******/

/****** Payment Streams pallet ******/
parameter_types! {
    pub const PaymentStreamHoldReason: RuntimeHoldReason = RuntimeHoldReason::PaymentStreams(pallet_payment_streams::HoldReason::PaymentStreamDeposit);
    pub const UserWithoutFundsCooldown: BlockNumber = 100;
}

impl pallet_payment_streams::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type WeightInfo = pallet_payment_streams::weights::SubstrateWeight<Runtime>;
    type NativeBalance = Balances;
    type ProvidersPallet = Providers;
    type RuntimeHoldReason = RuntimeHoldReason;
    type UserWithoutFundsCooldown = UserWithoutFundsCooldown; // Amount of blocks that a user will have to wait before being able to clear the out of funds flag
    type NewStreamDeposit = ConstU32<10>; // Amount of blocks that the deposit of a new stream should be able to pay for
    type Units = StorageDataUnit; // Storage unit
    type BlockNumberToBalance = BlockNumberToBalance;
    type ProvidersProofSubmitters = ProofsDealer;
    type TreasuryCutCalculator = LinearThenPowerOfTwoTreasuryCutCalculator<Runtime, Perbill>;
    type TreasuryAccount = TreasuryAccount;
    type MaxUsersToCharge = ConstU32<10>;
    type BaseDeposit = ConstU128<10>;
}

// Converter from the BlockNumber type to the Balance type for math
pub struct BlockNumberToBalance;
impl Convert<BlockNumber, Balance> for BlockNumberToBalance {
    fn convert(block_number: BlockNumber) -> Balance {
        block_number.into() // In this converter we assume that the block number type is smaller in size than the balance type
    }
}

impl LinearThenPowerOfTwoTreasuryCutCalculatorConfig<Perbill> for Runtime {
    type Balance = Balance;
    type ProvidedUnit = StorageDataUnit;
    type IdealUtilisationRate = runtime_config::IdealUtilisationRate;
    type DecayRate = runtime_config::DecayRate;
    type MinimumCut = runtime_config::MinimumTreasuryCut;
    type MaximumCut = runtime_config::MaximumTreasuryCut;
}
/****** ****** ****** ******/

/****** Proofs Dealer pallet ******/
const RANDOM_CHALLENGES_PER_BLOCK: u32 = 10;
const MAX_CUSTOM_CHALLENGES_PER_BLOCK: u32 = 10;
const TOTAL_MAX_CHALLENGES_PER_BLOCK: u32 =
    RANDOM_CHALLENGES_PER_BLOCK + MAX_CUSTOM_CHALLENGES_PER_BLOCK;

parameter_types! {
    pub const RandomChallengesPerBlock: u32 = RANDOM_CHALLENGES_PER_BLOCK;
    pub const MaxCustomChallengesPerBlock: u32 = MAX_CUSTOM_CHALLENGES_PER_BLOCK;
    pub const TotalMaxChallengesPerBlock: u32 = TOTAL_MAX_CHALLENGES_PER_BLOCK;
    pub const TargetTicksStorageOfSubmitters: u32 = 3;
    pub const ChallengeHistoryLength: BlockNumber = 100;
    pub const ChallengesQueueLength: u32 = 100;
    pub const ChallengesFee: Balance = 0;
    pub const ChallengeTicksTolerance: u32 = 50;
    pub const PriorityChallengesFee: Balance = 0;
}

impl pallet_proofs_dealer::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type WeightInfo = pallet_proofs_dealer::weights::SubstrateWeight<Runtime>;
    type ProvidersPallet = Providers;
    type NativeBalance = Balances;
    type MerkleTrieHash = Hash;
    type MerkleTrieHashing = BlakeTwo256;
    type ForestVerifier = ForestVerifier<StorageProofsMerkleTrieLayout, { BlakeTwo256::LENGTH }>;
    type KeyVerifier = FileKeyVerifier<
        StorageProofsMerkleTrieLayout,
        { shp_constants::H_LENGTH },
        { shp_constants::FILE_CHUNK_SIZE },
        { shp_constants::FILE_SIZE_TO_CHALLENGES },
    >;
    type StakeToBlockNumber = SaturatingBalanceToBlockNumber;
    type RandomChallengesPerBlock = RandomChallengesPerBlock;
    type MaxCustomChallengesPerBlock = MaxCustomChallengesPerBlock;
    type MaxSubmittersPerTick = MaxSubmittersPerTick;
    type TargetTicksStorageOfSubmitters = TargetTicksStorageOfSubmitters;
    type ChallengeHistoryLength = ChallengeHistoryLength;
    type ChallengesQueueLength = ChallengesQueueLength;
    type CheckpointChallengePeriod = runtime_config::CheckpointChallengePeriod;
    type ChallengesFee = ChallengesFee;
    type PriorityChallengesFee = PriorityChallengesFee;
    type Treasury = TreasuryAccount;
    // TODO: Once the client logic to keep track of CR randomness deadlines and execute their submissions is implemented
    // AND after the chain has been live for enough time to have enough providers to avoid the commit-reveal randomness being
    // gameable, the randomness provider should be CrRandomness
    type RandomnessProvider = pallet_randomness::ParentBlockRandomness<Runtime>;
    type StakeToChallengePeriod = runtime_config::StakeToChallengePeriod;
    type MinChallengePeriod = runtime_config::MinChallengePeriod;
    type ChallengeTicksTolerance = ChallengeTicksTolerance;
    type BlockFullnessPeriod = ChallengeTicksTolerance; // We purposely set this to `ChallengeTicksTolerance` so that spamming of the chain is evaluated for the same blocks as the tolerance BSPs are given.
    type BlockFullnessHeadroom = BlockFullnessHeadroom;
    type MinNotFullBlocksRatio = MinNotFullBlocksRatio;
    type MaxSlashableProvidersPerTick = MaxSlashableProvidersPerTick;
    type ChallengeOrigin = EnsureRoot<AccountId>;
    type PriorityChallengeOrigin = EnsureRoot<AccountId>;
}

// Converter from the Balance type to the BlockNumber type for math.
// It performs a saturated conversion, so that the result is always a valid BlockNumber.
pub struct SaturatingBalanceToBlockNumber;
impl Convert<Balance, BlockNumberFor<Runtime>> for SaturatingBalanceToBlockNumber {
    fn convert(block_number: Balance) -> BlockNumberFor<Runtime> {
        block_number.saturated_into()
    }
}

pub struct MaxSubmittersPerTick;
impl Get<u32> for MaxSubmittersPerTick {
    fn get() -> u32 {
        let block_weights = <Runtime as frame_system::Config>::BlockWeights::get();

        // Not being able to get the `max_total` weight for the Normal dispatch class is considered
        // a critical bug. So we set it to be zero, essentially allowing zero submitters per tick.
        // This value can be read from the constants of a node, but with the current configuration, this is:
        //
        // max_total: {
        //   ref_time: 1,500,000,000,000
        //   proof_size: 3,932,160
        // }
        let max_weight_for_class = block_weights
            .get(DispatchClass::Normal)
            .max_total
            .unwrap_or(Zero::zero());

        // Get the minimum weight a `submit_proof` extrinsic can have.
        // This would be the case where the proof is just made up of a single file key proof, that is a
        // response to all the random challenges. And there are no checkpoint challenges.
        // With the current benchmarking, this is:
        //
        // TODO: UPDATE THIS WITH THE FINAL BENCHMARKING
        // min_weight_for_submit_proof: {
        //   ref_time: 2,980,252,675
        //   proof_size: 16,056
        // }
        let min_weight_for_submit_proof =
            <pallet_proofs_dealer::weights::SubstrateWeight<Runtime> as pallet_proofs_dealer::weights::WeightInfo>::submit_proof_no_checkpoint_challenges_key_proofs(1);

        // Calculate the maximum number of submit proofs that is possible to have in a block/tick.
        // With the current values, this would be:
        //
        // TODO: UPDATE THIS WITH THE FINAL BENCHMARKING
        // 244 proof submissions per block (limited by `proof_size`)
        let max_proof_submissions_per_tick = max_weight_for_class
            .checked_div_per_component(&min_weight_for_submit_proof)
            .unwrap_or(0);

        // Saturating u64 to u32 should be enough.
        max_proof_submissions_per_tick.saturated_into()
    }
}

pub struct BlockFullnessHeadroom;
impl Get<Weight> for BlockFullnessHeadroom {
    fn get() -> Weight {
        // The block headroom is set to be the maximum benchmarked weight that a `submit_proof` extrinsic can have.
        // That is, when the proof includes two file key proofs for every single random challenge, and for the maximum
        // number of checkpoint challenges as well.
        <pallet_proofs_dealer::weights::SubstrateWeight<Runtime> as pallet_proofs_dealer::weights::WeightInfo>::submit_proof_with_checkpoint_challenges_key_proofs(TOTAL_MAX_CHALLENGES_PER_BLOCK * 2)
    }
}

pub struct MinNotFullBlocksRatio;
impl Get<Perbill> for MinNotFullBlocksRatio {
    fn get() -> Perbill {
        // This means that we tolerate at most 50% of misbehaving collators.
        Perbill::from_percent(50)
    }
}

pub struct MaxSlashableProvidersPerTick;
impl Get<u32> for MaxSlashableProvidersPerTick {
    fn get() -> u32 {
        // With the maximum number of slashable providers per tick being `N`, the absolute maximum
        // weight that the `on_poll` hook can have, with the current benchmarking, is:
        //
        // TODO: UPDATE THIS WITH THE FINAL BENCHMARKING
        // new_challenges_round_weight: {
        //   ref_time: 576,000,000 + N * 551,601,146
        //   proof_size: 8,523 + N * 3,158
        // }
        // new_checkpoint_challenge_round_max_weight: {
        //   ref_time: 587,205,208 + ChallengesQueueLength * 225,083 = 610,554,678
        //   proof_size: 4,787
        // }
        // check_spamming_condition_weight: {
        //   ref_time: 313,000,000
        //   proof_size: 6,012
        // }
        //
        // For `N` = 1000, this would be:
        // max_on_poll_weight: {
        //   ref_time: 313,000,000 + 610,554,678 + 576,000,000 + N * 551,601,146 ≈ 553,100,700,678
        //   proof_size: 6,012 + 4,787 + 8,523 + N * 3,158 ≈ 3,177,322
        // }
        //
        // Consider that the maximum block weight is:
        // maxBlock: {
        //   ref_time: 2,000,000,000,000
        //   proof_size: 5,242,880
        // }
        //
        // This `on_poll` hook would consume roughly 1/4 of the block `ref_time` and 3/5 of the block `proof_size`.
        // This is naturally a lot. But it would be a very unlikely scenario.
        //
        // This would be the case where all `N` Providers have synchronised their challenge periods
        // and have the same deadline, plus, all of them missed their proof submissions.
        // The normal scenario would be that NONE (or just a small number) of the Providers have
        // missed their proof submissions.
        let max_slashable_providers_per_tick = 1000;
        max_slashable_providers_per_tick
    }
}
/****** ****** ****** ******/

/****** File System pallet ******/
type ThresholdType = u32;
pub type ReplicationTargetType = u32;

parameter_types! {
    pub const BaseStorageRequestCreationDeposit: Balance = 1 * HAVE;
    pub const FileDeletionRequestCreationDeposit: Balance = 1 * HAVE;
    pub const FileSystemStorageRequestCreationHoldReason: RuntimeHoldReason = RuntimeHoldReason::FileSystem(pallet_file_system::HoldReason::StorageRequestCreationHold);
    pub const FileSystemFileDeletionRequestHoldReason: RuntimeHoldReason = RuntimeHoldReason::FileSystem(pallet_file_system::HoldReason::FileDeletionRequestHold);
}

// Converts a given signed message in a EIP-191 compliant message bytes to verify.
/// EIP-191: https://eips.ethereum.org/EIPS/eip-191
/// "\x19Ethereum Signed Message:\n" + len(message) + message"
pub struct Eip191Adapter;
impl shp_traits::MessageAdapter for Eip191Adapter {
    fn bytes_to_verify(message: &[u8]) -> Vec<u8> {
        const PREFIX: &str = "\x19Ethereum Signed Message:\n";
        let len = message.len();
        let mut len_string_buffer = itoa::Buffer::new();
        let len_string = len_string_buffer.format(len);

        let mut eth_message = Vec::with_capacity(PREFIX.len() + len_string.len() + len);
        eth_message.extend_from_slice(PREFIX.as_bytes());
        eth_message.extend_from_slice(len_string.as_bytes());
        eth_message.extend_from_slice(message);
        eth_message
    }
}

impl pallet_file_system::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type WeightInfo = pallet_file_system::weights::SubstrateWeight<Runtime>;
    type Providers = Providers;
    type ProofDealer = ProofsDealer;
    type PaymentStreams = PaymentStreams;
    // TODO: Replace the mocked CR randomness with the actual one when it's ready
    // type CrRandomness = CrRandomness;
    type CrRandomness = MockCrRandomness;
    type UpdateStoragePrice = MostlyStablePriceIndexUpdater<Runtime>;
    type UserSolvency = PaymentStreams;
    type Fingerprint = Hash;
    type ReplicationTargetType = ReplicationTargetType;
    type ThresholdType = ThresholdType;
    type ThresholdTypeToTickNumber = ThresholdTypeToBlockNumberConverter;
    type HashToThresholdType = HashToThresholdTypeConverter;
    type MerkleHashToRandomnessOutput = MerkleHashToRandomnessOutputConverter;
    type ChunkIdToMerkleHash = ChunkIdToMerkleHashConverter;
    type Currency = Balances;
    type RuntimeHoldReason = RuntimeHoldReason;
    type Nfts = Nfts;
    type CollectionInspector = BucketNfts;
    type BspStopStoringFilePenalty = runtime_config::BspStopStoringFilePenalty;
    type TreasuryAccount = TreasuryAccount;
    type MaxBatchConfirmStorageRequests = ConstU32<100>;
    type MaxFilePathSize = ConstU32<512u32>;
    type MaxPeerIdSize = ConstU32<100>;
    type MaxNumberOfPeerIds = ConstU32<5>;
    type MaxDataServerMultiAddresses = ConstU32<10>;
    type MaxExpiredItemsInTick = ConstU32<100>;
    type StorageRequestTtl = runtime_config::StorageRequestTtl;
    type MoveBucketRequestTtl = ConstU32<40u32>;
    type MaxUserPendingDeletionRequests = ConstU32<10u32>;
    type MaxUserPendingMoveBucketRequests = ConstU32<10u32>;
    type MinWaitForStopStoring = runtime_config::MinWaitForStopStoring;
    type BaseStorageRequestCreationDeposit = BaseStorageRequestCreationDeposit;
    type UpfrontTicksToPay = runtime_config::UpfrontTicksToPay;
    type WeightToFee = WeightToFee;
    type ReplicationTargetToBalance = ReplicationTargetToBalance;
    type TickNumberToBalance = TickNumberToBalance;
    type StorageDataUnitToBalance = StorageDataUnitToBalance;
    type FileDeletionRequestDeposit = FileDeletionRequestCreationDeposit;
    type BasicReplicationTarget = runtime_config::BasicReplicationTarget;
    type StandardReplicationTarget = runtime_config::StandardReplicationTarget;
    type HighSecurityReplicationTarget = runtime_config::HighSecurityReplicationTarget;
    type SuperHighSecurityReplicationTarget = runtime_config::SuperHighSecurityReplicationTarget;
    type UltraHighSecurityReplicationTarget = runtime_config::UltraHighSecurityReplicationTarget;
    type MaxReplicationTarget = runtime_config::MaxReplicationTarget;
    type TickRangeToMaximumThreshold = runtime_config::TickRangeToMaximumThreshold;
    type OffchainSignature = Signature;
    type OffchainPublicKey = <Signature as Verify>::Signer;
    type MaxFileDeletionsPerExtrinsic = ConstU32<100>;
    type IntentionMsgAdapter = Eip191Adapter;
}

impl MostlyStablePriceIndexUpdaterConfig for Runtime {
    type Price = Balance;
    type StorageDataUnit = StorageDataUnit;
    type LowerThreshold = runtime_config::SystemUtilisationLowerThresholdPercentage;
    type UpperThreshold = runtime_config::SystemUtilisationUpperThresholdPercentage;
    type MostlyStablePrice = runtime_config::MostlyStablePrice;
    type MaxPrice = runtime_config::MaxPrice;
    type MinPrice = runtime_config::MinPrice;
    type UpperExponentFactor = runtime_config::UpperExponentFactor;
    type LowerExponentFactor = runtime_config::LowerExponentFactor;
}

// Converter from the ThresholdType to the BlockNumber type and vice versa.
// It performs a saturated conversion, so that the result is always a valid BlockNumber.
pub struct ThresholdTypeToBlockNumberConverter;
impl Convert<ThresholdType, BlockNumberFor<Runtime>> for ThresholdTypeToBlockNumberConverter {
    fn convert(threshold: ThresholdType) -> BlockNumberFor<Runtime> {
        threshold.saturated_into()
    }
}

impl ConvertBack<ThresholdType, BlockNumberFor<Runtime>> for ThresholdTypeToBlockNumberConverter {
    fn convert_back(block_number: BlockNumberFor<Runtime>) -> ThresholdType {
        block_number.into()
    }
}

/// Converter from the [`Hash`] type to the [`ThresholdType`].
pub struct HashToThresholdTypeConverter;
impl Convert<<Runtime as frame_system::Config>::Hash, ThresholdType>
    for HashToThresholdTypeConverter
{
    fn convert(hash: <Runtime as frame_system::Config>::Hash) -> ThresholdType {
        // Get the hash as bytes
        let hash_bytes = hash.as_ref();

        // Get the 4 least significant bytes of the hash and interpret them as an u32
        let truncated_hash_bytes: [u8; 4] =
            hash_bytes[28..].try_into().expect("Hash is 32 bytes; qed");

        ThresholdType::from_be_bytes(truncated_hash_bytes)
    }
}

// Converter from the MerkleHash (H256) type to the RandomnessOutput (H256) type.
pub struct MerkleHashToRandomnessOutputConverter;
impl Convert<H256, H256> for MerkleHashToRandomnessOutputConverter {
    fn convert(hash: H256) -> H256 {
        hash
    }
}

// Converter from the ChunkId type to the MerkleHash (H256) type.
pub struct ChunkIdToMerkleHashConverter;

impl Convert<ChunkId, H256> for ChunkIdToMerkleHashConverter {
    fn convert(chunk_id: ChunkId) -> H256 {
        let chunk_id_biguint = BigUint::from(chunk_id.as_u64());
        let mut bytes = chunk_id_biguint.to_bytes_be();

        // Ensure the byte slice is exactly 32 bytes long by padding with leading zeros
        if bytes.len() < 32 {
            let mut padded_bytes = vec![0u8; 32 - bytes.len()];
            padded_bytes.extend(bytes);
            bytes = padded_bytes;
        }

        H256::from_slice(&bytes)
    }
}

// Converter from the ReplicationTargetType type to the Balance type.
pub struct ReplicationTargetToBalance;
impl Convert<ReplicationTargetType, Balance> for ReplicationTargetToBalance {
    fn convert(replication_target: ReplicationTargetType) -> Balance {
        replication_target.into()
    }
}

// Converter from the TickNumber type to the Balance type.
pub type TickNumber = BlockNumber;
pub struct TickNumberToBalance;
impl Convert<TickNumber, Balance> for TickNumberToBalance {
    fn convert(tick_number: TickNumber) -> Balance {
        tick_number.into()
    }
}

// Converter from the StorageDataUnit type to the Balance type.
pub struct StorageDataUnitToBalance;
impl Convert<StorageDataUnit, Balance> for StorageDataUnitToBalance {
    fn convert(storage_data_unit: StorageDataUnit) -> Balance {
        storage_data_unit.into()
    }
}
/****** ****** ****** ******/

/****** Bucket NFTs pallet ******/
impl pallet_bucket_nfts::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type WeightInfo = pallet_bucket_nfts::weights::SubstrateWeight<Runtime>;
    type Buckets = Providers;
}
/****** ****** ****** ******/

/****** Commit-Reveal Randomness pallet ******/
pub struct MockCrRandomness;
impl shp_traits::CommitRevealRandomnessInterface for MockCrRandomness {
    type ProviderId = Hash;

    fn initialise_randomness_cycle(
        _who: &Self::ProviderId,
    ) -> frame_support::dispatch::DispatchResult {
        Ok(())
    }

    fn stop_randomness_cycle(_who: &Self::ProviderId) -> frame_support::dispatch::DispatchResult {
        Ok(())
    }
}
/****** ****** ****** ******/
