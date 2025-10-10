// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.3;

/// @dev The Identity contract's address.
address constant IDENTITY_ADDRESS = 0x0000000000000000000000000000000000000818;

/// @dev The Identity contract's instance.
Identity constant IDENTITY_CONTRACT = Identity(IDENTITY_ADDRESS);

/// @author The Moonbeam Team
/// @title Pallet Identity Interface
/// @title The interface through which solidity contracts will interact with the Identity pallet
/// @custom:address 0x0000000000000000000000000000000000000818
interface Identity {
    /// @dev Associated raw data.
    struct Data {
        /// Is `true` if it represents data, else the absense of data is represented by `false`.
        bool hasData;
        /// The contained value.
        bytes value;
    }

    /// @dev The super-identity of an alternative "sub" identity.
    struct SuperOf {
        /// Is `true` if the struct is valid, `false` otherwise.
        bool isValid;
        /// The super account.
        address account;
        /// The associated data.
        Data data;
    }

    /// @dev Alternative "sub" identities of an account.
    struct SubsOf {
        /// The deposit against this identity.
        uint256 deposit;
        /// The sub accounts
        address[] accounts;
    }

    /// @dev Registrar judgements are limited to attestations on these fields.
    struct IdentityFields {
        /// Set to `true` if the display field is supported, `false` otherwise.
        bool display;
        /// Set to `true` if the legal field is supported, `false` otherwise.
        bool legal;
        /// Set to `true` if the web field is supported, `false` otherwise.
        bool web;
        /// Set to `true` if the riot field is supported, `false` otherwise.
        bool riot;
        /// Set to `true` if the email field is supported, `false` otherwise.
        bool email;
        /// Set to `true` if the PGP Fingerprint field is supported, `false` otherwise.
        bool pgpFingerprint;
        /// Set to `true` if the image field is supported, `false` otherwise.
        bool image;
        /// Set to `true` if the twitter field is supported, `false` otherwise.
        bool twitter;
    }

    /// @dev Registrar info.
    struct Registrar {
        /// Is `true` if the struct is valid, `false` otherwise.
        bool isValid;
        /// The registrar's index.
        uint32 index;
        /// The account address.
        address account;
        /// Amount required to be given to the registrar for them to provide judgement.
        uint256 fee;
        /// Relevant fields for this registrar.
        IdentityFields fields;
    }

    /// @dev Represents an additional field in identity info.
    struct Additional {
        /// The assciated key.
        Data key;
        /// The assciated value.
        Data value;
    }

    /// @dev The identity information set for an account.
    struct IdentityInfo {
        /// Represents the additional fields for the identity.
        Additional[] additional;
        /// Represents the display info for the identity.
        Data display;
        /// Represents the legal info for the identity.
        Data legal;
        /// Represents the web info for the identity.
        Data web;
        /// Represents the riot info for the identity.
        Data riot;
        /// Represents the email info for the identity.
        Data email;
        /// Set to `true` if `pgpFingerprint` is set, `false` otherwise.
        bool hasPgpFingerprint;
        /// Represents a 20-byte the PGP fingerprint info for the identity.
        bytes pgpFingerprint;
        /// Represents the image info for the identity.
        Data image;
        /// Represents the twitter info for the identity.
        Data twitter;
    }

    /// @dev Judgement provided by a registrar.
    struct Judgement {
        /// The default value; no opinion is held.
        bool isUnknown;
        /// No judgement is yet in place, but a deposit is reserved as payment for providing one.
        bool isFeePaid;
        /// The deposit reserved for providing a judgement.
        uint256 feePaidDeposit;
        /// The data appears to be reasonably acceptable in terms of its accuracy.
        bool isReasonable;
        /// The target is known directly by the registrar and the registrar can fully attest to it.
        bool isKnownGood;
        /// The data was once good but is currently out of date.
        bool isOutOfDate;
        /// The data is imprecise or of sufficiently low-quality to be problematic.
        bool isLowQuality;
        /// The data is erroneous. This may be indicative of malicious intent.
        bool isErroneous;
    }

    /// @dev Judgement item provided by a registrar.
    struct JudgementInfo {
        /// The registrar's index that provided this judgement.
        uint32 registrarIndex;
        /// The registrar's provided judgement.
        Judgement judgement;
    }

    /// @dev Registrar info.
    struct Registration {
        /// Is `true` if the struct is valid, `false` otherwise.
        bool isValid;
        /// The judgments provided on this identity.
        JudgementInfo[] judgements;
        /// Amount required to be given to the registrar for them to provide judgement.
        uint256 deposit;
        /// The associated identity info.
        IdentityInfo info;
    }

    /// @dev Alternative "sub" identity of an account.
    struct SubAccount {
        /// The account address.
        address account;
        /// The associated data.
        Data data;
    }

    /// @dev Retrieve identity information for an account.
    /// @custom:selector f0eb5e54
    /// @param who The requested account
    function identity(address who) external view returns (Registration memory);

    /// @dev Retrieve super account for an account.
    /// @custom:selector c18110d6
    /// @param who The requested account
    function superOf(address who) external view returns (SuperOf memory);

    /// @dev Retrieve sub accounts for an account.
    /// @custom:selector 3f08986b
    /// @param who The requested account
    function subsOf(address who) external view returns (SubsOf memory);

    /// @dev Retrieve the registrars.
    /// @custom:selector e88e512e
    function registrars() external view returns (Registrar[] memory);

    /// @dev Set identity info for the caller.
    /// @custom:selector 7e08b4cb
    /// @param info The identity info
    function setIdentity(IdentityInfo memory info) external;

    /// @dev Set sub accounts for the caller.
    /// @custom:selector 5a5a3591
    /// @param subs The sub accounts
    function setSubs(SubAccount[] memory subs) external;

    /// @dev Clears identity of the caller.
    /// @custom:selector 7a6a10c7
    function clearIdentity() external;

    /// @dev Requests registrar judgement on caller's identity.
    /// @custom:selector d523ceb9
    /// @param regIndex The registrar's index
    /// @param maxFee The maximum fee the caller is willing to pay
    function requestJudgement(uint32 regIndex, uint256 maxFee) external;

    /// @dev Cancels the caller's request for judgement from a registrar.
    /// @custom:selector c79934a5
    /// @param regIndex The registrar's index
    function cancelRequest(uint32 regIndex) external;

    /// @dev Sets the registrar's fee for providing a judgement. Caller must be the account at the index.
    /// @custom:selector a541b37d
    /// @param regIndex The registrar's index
    /// @param fee The fee the registrar will charge
    function setFee(uint32 regIndex, uint256 fee) external;

    /// @dev Sets the registrar's account. Caller must be the account at the index.
    /// @custom:selector 889bc198
    /// @param regIndex The registrar's index
    /// @param newAccount The new account to set
    function setAccountId(uint32 regIndex, address newAccount) external;

    /// @dev Sets the registrar's identity fields. Caller must be the account at the index.
    /// @custom:selector 05297450
    /// @param regIndex The registrar's index
    /// @param fields The identity fields
    function setFields(uint32 regIndex, IdentityFields memory fields) external;

    /// @dev Provides judgement on an accounts identity.
    /// @custom:selector cd7663a4
    /// @param regIndex The registrar's index
    /// @param target The target account to provide judgment for
    /// @param judgement The judgement to provide
    /// @param identity The hash of the identity info
    function provideJudgement(
        uint32 regIndex,
        address target,
        Judgement memory judgement,
        bytes32 identity
    ) external;

    /// @dev Add a "sub" identity account for the caller.
    /// @custom:selector 98717196
    /// @param sub The sub account
    /// @param data The associated data
    function addSub(address sub, Data memory data) external;

    /// @dev Rename a "sub" identity account of the caller.
    /// @custom:selector 452df561
    /// @param sub The sub account
    /// @param data The new assocaited data
    function renameSub(address sub, Data memory data) external;

    /// @dev Removes a "sub" identity account of the caller.
    /// @custom:selector b0a323e0
    /// @param sub The sub account
    function removeSub(address sub) external;

    /// @dev Removes the sender as a sub-account.
    /// @custom:selector d5a3c2c4
    function quitSub() external;

    /// @dev An identity was set or reset (which will remove all judgements).
    /// @custom:selector 3839f7832b2a6263aa1fd5040f37d10fd4f9e9c4a9ef07ec384cb1cef9fb4c0e
    /// @param who Address of the target account
    event IdentitySet(address who);

    /// @dev An identity was cleared, and the given balance returned.
    /// @custom:selector 3839f7832b2a6263aa1fd5040f37d10fd4f9e9c4a9ef07ec384cb1cef9fb4c0e
    /// @param who Address of the target account
    event IdentityCleared(address who);

    /// @dev A judgement was asked from a registrar.
    /// @custom:selector 3839f7832b2a6263aa1fd5040f37d10fd4f9e9c4a9ef07ec384cb1cef9fb4c0e
    /// @param who Address of the requesting account
    /// @param registrarIndex The registrar's index
    event JudgementRequested(address who, uint32 registrarIndex);

    /// @dev A judgement request was retracted.
    /// @custom:selector 3839f7832b2a6263aa1fd5040f37d10fd4f9e9c4a9ef07ec384cb1cef9fb4c0e
    /// @param who Address of the target account.
    /// @param registrarIndex The registrar's index
    event JudgementUnrequested(address who, uint32 registrarIndex);

    /// @dev A judgement was given by a registrar.
    /// @custom:selector 3839f7832b2a6263aa1fd5040f37d10fd4f9e9c4a9ef07ec384cb1cef9fb4c0e
    /// @param target Address of the target account
    /// @param registrarIndex The registrar's index
    event JudgementGiven(address target, uint32 registrarIndex);

    /// @dev A sub-identity was added to an identity and the deposit paid.
    /// @custom:selector 3839f7832b2a6263aa1fd5040f37d10fd4f9e9c4a9ef07ec384cb1cef9fb4c0e
    /// @param sub Address of the sub account
    /// @param main Address of the main account
    event SubIdentityAdded(address sub, address main);

    /// @dev A sub-identity was removed from an identity and the deposit freed.
    /// @custom:selector 3839f7832b2a6263aa1fd5040f37d10fd4f9e9c4a9ef07ec384cb1cef9fb4c0e
    /// @param sub Address of the sub account
    /// @param main Address of the main account
    event SubIdentityRemoved(address sub, address main);

    /// @dev A sub-identity was cleared and the given deposit repatriated from the main identity account to the sub-identity account
    /// @custom:selector 3839f7832b2a6263aa1fd5040f37d10fd4f9e9c4a9ef07ec384cb1cef9fb4c0e
    /// @param sub Address of the sub account
    event SubIdentityRevoked(address sub);
}
