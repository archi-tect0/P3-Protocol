// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ReceiptBoundToken
 * @notice Non-transferable NFT receipts for P3 Protocol
 * @dev ERC721 tokens that cannot be transferred (soulbound)
 */
contract ReceiptBoundToken is ERC721, Ownable {
    struct Receipt {
        bytes32 eventHash;
        uint256 timestamp;
        address issuer;
        string metadata;
    }

    mapping(uint256 => Receipt) public receipts;
    mapping(bytes32 => uint256) public eventHashToTokenId;
    
    uint256 private _tokenIdCounter;

    event ReceiptIssued(
        uint256 indexed tokenId,
        address indexed recipient,
        bytes32 indexed eventHash,
        uint256 timestamp
    );

    constructor() ERC721("P3 Receipt", "P3RCP") Ownable(msg.sender) {}

    /**
     * @notice Issue a new receipt to a user
     * @param recipient The recipient address
     * @param eventHash Hash of the event
     * @param metadata Additional metadata
     */
    function issueReceipt(
        address recipient,
        bytes32 eventHash,
        string calldata metadata
    ) external onlyOwner returns (uint256) {
        require(recipient != address(0), "Invalid recipient");
        require(eventHash != bytes32(0), "Invalid event hash");
        require(eventHashToTokenId[eventHash] == 0, "Receipt already issued for this event");

        _tokenIdCounter++;
        uint256 tokenId = _tokenIdCounter;

        _safeMint(recipient, tokenId);

        receipts[tokenId] = Receipt({
            eventHash: eventHash,
            timestamp: block.timestamp,
            issuer: msg.sender,
            metadata: metadata
        });

        eventHashToTokenId[eventHash] = tokenId;

        emit ReceiptIssued(tokenId, recipient, eventHash, block.timestamp);

        return tokenId;
    }

    /**
     * @notice Get receipt details
     * @param tokenId The token ID
     */
    function getReceipt(uint256 tokenId) external view returns (Receipt memory) {
        require(ownerOf(tokenId) != address(0), "Receipt does not exist");
        return receipts[tokenId];
    }

    /**
     * @notice Override transfer functions to make tokens non-transferable
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);
        
        // Allow minting (from == address(0))
        // Disallow transfers (from != address(0) && to != address(0))
        // Allow burning (to == address(0))
        if (from != address(0) && to != address(0)) {
            revert("Receipt tokens are non-transferable");
        }

        return super._update(to, tokenId, auth);
    }

    /**
     * @notice Check if a receipt exists for an event hash
     * @param eventHash The event hash
     */
    function receiptExists(bytes32 eventHash) external view returns (bool) {
        return eventHashToTokenId[eventHash] != 0;
    }

    /**
     * @notice Get token ID for an event hash
     * @param eventHash The event hash
     */
    function getTokenIdByEventHash(bytes32 eventHash) external view returns (uint256) {
        uint256 tokenId = eventHashToTokenId[eventHash];
        require(tokenId != 0, "No receipt for this event");
        return tokenId;
    }
}
