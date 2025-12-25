// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ConsentRegistry
 * @notice User consent tracking for P3 Protocol
 * @dev Manages user consents for data processing and sharing
 */
contract ConsentRegistry is Ownable {
    struct Consent {
        address user;
        bytes32 purposeHash;
        bool granted;
        uint256 timestamp;
        uint256 expiresAt;
        string metadata;
    }

    mapping(address => mapping(bytes32 => Consent)) public consents;
    mapping(address => bytes32[]) public userConsentPurposes;
    
    event ConsentGranted(
        address indexed user,
        bytes32 indexed purposeHash,
        uint256 timestamp,
        uint256 expiresAt
    );
    
    event ConsentRevoked(
        address indexed user,
        bytes32 indexed purposeHash,
        uint256 timestamp
    );

    event ConsentUpdated(
        address indexed user,
        bytes32 indexed purposeHash,
        uint256 timestamp,
        uint256 newExpiresAt
    );

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Grant consent for a specific purpose
     * @param purposeHash Hash representing the purpose
     * @param expiresAt Expiration timestamp (0 for no expiration)
     * @param metadata Additional metadata
     */
    function grantConsent(
        bytes32 purposeHash,
        uint256 expiresAt,
        string calldata metadata
    ) external {
        require(purposeHash != bytes32(0), "Invalid purpose hash");
        
        if (expiresAt > 0) {
            require(expiresAt > block.timestamp, "Expiration must be in future");
        }

        Consent storage consent = consents[msg.sender][purposeHash];
        
        if (!consent.granted) {
            userConsentPurposes[msg.sender].push(purposeHash);
        }

        consent.user = msg.sender;
        consent.purposeHash = purposeHash;
        consent.granted = true;
        consent.timestamp = block.timestamp;
        consent.expiresAt = expiresAt;
        consent.metadata = metadata;

        emit ConsentGranted(msg.sender, purposeHash, block.timestamp, expiresAt);
    }

    /**
     * @notice Revoke consent for a specific purpose
     * @param purposeHash Hash representing the purpose
     */
    function revokeConsent(bytes32 purposeHash) external {
        Consent storage consent = consents[msg.sender][purposeHash];
        require(consent.granted, "Consent not granted");

        consent.granted = false;
        consent.timestamp = block.timestamp;

        emit ConsentRevoked(msg.sender, purposeHash, block.timestamp);
    }

    /**
     * @notice Update consent expiration
     * @param purposeHash Hash representing the purpose
     * @param newExpiresAt New expiration timestamp
     */
    function updateConsentExpiration(
        bytes32 purposeHash,
        uint256 newExpiresAt
    ) external {
        Consent storage consent = consents[msg.sender][purposeHash];
        require(consent.granted, "Consent not granted");
        
        if (newExpiresAt > 0) {
            require(newExpiresAt > block.timestamp, "Expiration must be in future");
        }

        consent.expiresAt = newExpiresAt;
        consent.timestamp = block.timestamp;

        emit ConsentUpdated(msg.sender, purposeHash, block.timestamp, newExpiresAt);
    }

    /**
     * @notice Check if consent is valid
     * @param user User address
     * @param purposeHash Purpose hash
     */
    function hasValidConsent(
        address user,
        bytes32 purposeHash
    ) external view returns (bool) {
        Consent memory consent = consents[user][purposeHash];
        
        if (!consent.granted) {
            return false;
        }

        if (consent.expiresAt > 0 && block.timestamp >= consent.expiresAt) {
            return false;
        }

        return true;
    }

    /**
     * @notice Get consent details
     * @param user User address
     * @param purposeHash Purpose hash
     */
    function getConsent(
        address user,
        bytes32 purposeHash
    ) external view returns (Consent memory) {
        return consents[user][purposeHash];
    }

    /**
     * @notice Get all consent purposes for a user
     * @param user User address
     */
    function getUserConsentPurposes(
        address user
    ) external view returns (bytes32[] memory) {
        return userConsentPurposes[user];
    }
}
