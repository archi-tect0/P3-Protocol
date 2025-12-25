// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AnchorRegistry
 * @notice Event anchoring with bundle support for P3 Protocol
 * @dev Allows anchoring individual events or bundles of events to the blockchain
 */
contract AnchorRegistry is Ownable, ReentrancyGuard {
    struct Anchor {
        bytes32 eventHash;
        uint256 timestamp;
        address submitter;
        string metadata;
        bool isBundled;
        bytes32 bundleRoot;
    }

    struct Bundle {
        bytes32 merkleRoot;
        uint256 eventCount;
        uint256 timestamp;
        address submitter;
        string metadata;
    }

    mapping(bytes32 => Anchor) public anchors;
    mapping(bytes32 => Bundle) public bundles;
    mapping(bytes32 => bool) public anchorExists;
    mapping(bytes32 => bool) public bundleExists;

    uint256 public totalAnchors;
    uint256 public totalBundles;

    event EventAnchored(
        bytes32 indexed anchorId,
        bytes32 eventHash,
        address indexed submitter,
        uint256 timestamp
    );

    event BundleAnchored(
        bytes32 indexed bundleId,
        bytes32 merkleRoot,
        uint256 eventCount,
        address indexed submitter,
        uint256 timestamp
    );

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Anchor a single event
     * @param eventHash Hash of the event data
     * @param metadata Additional metadata for the event
     */
    function anchorEvent(
        bytes32 eventHash,
        string calldata metadata
    ) external nonReentrant returns (bytes32) {
        bytes32 anchorId = keccak256(
            abi.encodePacked(eventHash, msg.sender, block.timestamp)
        );
        
        require(!anchorExists[anchorId], "Anchor already exists");

        anchors[anchorId] = Anchor({
            eventHash: eventHash,
            timestamp: block.timestamp,
            submitter: msg.sender,
            metadata: metadata,
            isBundled: false,
            bundleRoot: bytes32(0)
        });

        anchorExists[anchorId] = true;
        totalAnchors++;

        emit EventAnchored(anchorId, eventHash, msg.sender, block.timestamp);

        return anchorId;
    }

    /**
     * @notice Anchor a bundle of events using a Merkle root
     * @param merkleRoot Merkle root of the event bundle
     * @param eventCount Number of events in the bundle
     * @param metadata Additional metadata for the bundle
     */
    function anchorBundle(
        bytes32 merkleRoot,
        uint256 eventCount,
        string calldata metadata
    ) external nonReentrant returns (bytes32) {
        bytes32 bundleId = keccak256(
            abi.encodePacked(merkleRoot, msg.sender, block.timestamp)
        );
        
        require(!bundleExists[bundleId], "Bundle already exists");
        require(eventCount > 0, "Event count must be positive");

        bundles[bundleId] = Bundle({
            merkleRoot: merkleRoot,
            eventCount: eventCount,
            timestamp: block.timestamp,
            submitter: msg.sender,
            metadata: metadata
        });

        bundleExists[bundleId] = true;
        totalBundles++;

        emit BundleAnchored(
            bundleId,
            merkleRoot,
            eventCount,
            msg.sender,
            block.timestamp
        );

        return bundleId;
    }

    /**
     * @notice Verify if an anchor exists
     * @param anchorId The anchor ID to check
     */
    function verifyAnchor(bytes32 anchorId) external view returns (bool) {
        return anchorExists[anchorId];
    }

    /**
     * @notice Verify if a bundle exists
     * @param bundleId The bundle ID to check
     */
    function verifyBundle(bytes32 bundleId) external view returns (bool) {
        return bundleExists[bundleId];
    }

    /**
     * @notice Get anchor details
     * @param anchorId The anchor ID
     */
    function getAnchor(bytes32 anchorId) external view returns (Anchor memory) {
        require(anchorExists[anchorId], "Anchor does not exist");
        return anchors[anchorId];
    }

    /**
     * @notice Get bundle details
     * @param bundleId The bundle ID
     */
    function getBundle(bytes32 bundleId) external view returns (Bundle memory) {
        require(bundleExists[bundleId], "Bundle does not exist");
        return bundles[bundleId];
    }
}
