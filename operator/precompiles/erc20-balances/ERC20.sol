// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.3;

/// @dev The IERC20 contract's address.
address constant IERC20_ADDRESS = 0x0000000000000000000000000000000000000802;

/// @dev The IERC20 contract's instance.
IERC20 constant IERC20_CONTRACT = IERC20(IERC20_ADDRESS);

/// @title ERC20 interface
/// @dev see https://github.com/ethereum/EIPs/issues/20
/// @dev copied from https://github.com/OpenZeppelin/openzeppelin-contracts
/// @custom:address 0x0000000000000000000000000000000000000802
interface IERC20 {
    /// @dev Returns the name of the token.
    /// @custom:selector 06fdde03
    function name() external view returns (string memory);

    /// @dev Returns the symbol of the token.
    /// @custom:selector 95d89b41
    function symbol() external view returns (string memory);

    /// @dev Returns the decimals places of the token.
    /// @custom:selector 313ce567
    function decimals() external view returns (uint8);

    /// @dev Total number of tokens in existence
    /// @custom:selector 18160ddd
    function totalSupply() external view returns (uint256);

    /// @dev Gets the balance of the specified address.
    /// @custom:selector 70a08231
    /// @param owner The address to query the balance of.
    /// @return An uint256 representing the amount owned by the passed address.
    function balanceOf(address owner) external view returns (uint256);

    /// @dev Function to check the amount of tokens that an owner allowed to a spender.
    /// @custom:selector dd62ed3e
    /// @param owner address The address which owns the funds.
    /// @param spender address The address which will spend the funds.
    /// @return A uint256 specifying the amount of tokens still available for the spender.
    function allowance(
        address owner,
        address spender
    ) external view returns (uint256);

    /// @dev Transfer token for a specified address
    /// @custom:selector a9059cbb
    /// @param to The address to transfer to.
    /// @param value The amount to be transferred.
    /// @return true if the transfer was succesful, revert otherwise.
    function transfer(address to, uint256 value) external returns (bool);

    /// @dev Approve the passed address to spend the specified amount of tokens on behalf of msg.sender.
    /// Beware that changing an allowance with this method brings the risk that someone may use both the old
    /// and the new allowance by unfortunate transaction ordering. One possible solution to mitigate this
    /// race condition is to first reduce the spender's allowance to 0 and set the desired value afterwards:
    /// https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
    /// @custom:selector 095ea7b3
    /// @param spender The address which will spend the funds.
    /// @param value The amount of tokens to be spent.
    /// @return true, this cannot fail
    function approve(address spender, uint256 value) external returns (bool);

    /// @dev Transfer tokens from one address to another
    /// @custom:selector 23b872dd
    /// @param from address The address which you want to send tokens from
    /// @param to address The address which you want to transfer to
    /// @param value uint256 the amount of tokens to be transferred
    /// @return true if the transfer was succesful, revert otherwise.
    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external returns (bool);

    /// @dev Event emited when a transfer has been performed.
    /// @custom:selector ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
    /// @param from address The address sending the tokens
    /// @param to address The address receiving the tokens.
    /// @param value uint256 The amount of tokens transfered.
    event Transfer(address indexed from, address indexed to, uint256 value);

    /// @dev Event emited when an approval has been registered.
    /// @custom:selector 8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925
    /// @param owner address Owner of the tokens.
    /// @param spender address Allowed spender.
    /// @param value uint256 Amount of tokens approved.
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );
}

/// @title Native currency wrapper interface.
/// @dev Allow compatibility with dApps expecting this precompile to be
/// a WETH-like contract.
/// Datahaven address : 0x0000000000000000000000000000000000000802
interface WrappedNativeCurrency {
    /// @dev Provide compatibility for contracts that expect wETH design.
    /// Returns funds to sender as this precompile tokens and the native tokens are the same.
    /// @custom:selector d0e30db0
    function deposit() external payable;

    /// @dev Provide compatibility for contracts that expect wETH design.
    /// Does nothing.
    /// @custom:selector 2e1a7d4d
    /// @param value uint256 The amount to withdraw/unwrap.
    function withdraw(uint256 value) external;

    /// @dev Event emited when deposit() has been called.
    /// @custom:selector e1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c
    /// @param owner address Owner of the tokens
    /// @param value uint256 The amount of tokens "wrapped".
    event Deposit(address indexed owner, uint256 value);

    /// @dev Event emited when withdraw(uint256) has been called.
    /// @custom:selector 7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65
    /// @param owner address Owner of the tokens
    /// @param value uint256 The amount of tokens "unwrapped".
    event Withdrawal(address indexed owner, uint256 value);
}
