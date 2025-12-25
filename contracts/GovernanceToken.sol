// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title GovernanceToken
 * @notice ERC20Votes token for P3 Protocol DAO
 * @dev Governance token with voting capabilities
 */
contract GovernanceToken is ERC20, ERC20Votes, Ownable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens

    constructor() 
        ERC20("P3 Governance Token", "P3GOV") 
        EIP712("P3 Governance Token", "1")
        Ownable(msg.sender) 
    {
        // Mint initial supply to deployer
        _mint(msg.sender, 100_000_000 * 10**18); // 100 million initial supply
    }

    /**
     * @notice Mint new tokens
     * @param to The recipient address
     * @param amount The amount to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
    }

    /**
     * @notice Burn tokens
     * @param amount The amount to burn
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    // Override required functions
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);
    }
}
