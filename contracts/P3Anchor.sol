// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title P3Anchor
 * @notice Cross-chain event anchoring for P3 Protocol
 * @dev Supports anchoring from API wallets and cross-chain routers
 */
contract P3Anchor is Ownable, ReentrancyGuard {
    struct AnchorRecord {
        bytes32 digest;
        address actor;
        uint256 timestamp;
        string eventType;
        string market;
        uint32 originChain;
        bool exists;
    }

    mapping(bytes32 => AnchorRecord) public anchors;
    mapping(address => bool) public isRouter;
    mapping(address => bool) public isApiWallet;

    uint256 public totalAnchors;
    uint256 public totalRouterAnchors;

    event Anchored(
        bytes32 indexed digest,
        address indexed actor,
        uint256 timestamp,
        string eventType,
        string market,
        uint32 originChain
    );

    event RouterUpdated(address indexed router, bool authorized);
    event ApiWalletUpdated(address indexed wallet, bool authorized);

    error Unauthorized();
    error InvalidAddress();
    error InvalidDigest();
    error AnchorAlreadyExists();

    modifier onlyRouter() {
        if (!isRouter[msg.sender]) revert Unauthorized();
        _;
    }

    modifier onlyApiWallet() {
        if (!isApiWallet[msg.sender]) revert Unauthorized();
        _;
    }

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Anchor an event from API wallet
     * @param digest Event digest hash
     * @param eventType Type of event being anchored
     * @param market Market identifier
     */
    function anchor(
        bytes32 digest,
        string calldata eventType,
        string calldata market
    ) external onlyApiWallet nonReentrant returns (bytes32) {
        if (digest == bytes32(0)) revert InvalidDigest();
        if (anchors[digest].exists) revert AnchorAlreadyExists();

        anchors[digest] = AnchorRecord({
            digest: digest,
            actor: msg.sender,
            timestamp: block.timestamp,
            eventType: eventType,
            market: market,
            originChain: uint32(block.chainid),
            exists: true
        });

        totalAnchors++;

        emit Anchored(
            digest,
            msg.sender,
            block.timestamp,
            eventType,
            market,
            uint32(block.chainid)
        );

        return digest;
    }

    /**
     * @notice Anchor an event from cross-chain router
     * @param digest Event digest hash
     * @param actor Original actor address
     * @param timestamp Original timestamp
     * @param eventType Type of event being anchored
     * @param market Market identifier
     * @param originChain Origin chain ID
     */
    function anchorFromRouter(
        bytes32 digest,
        address actor,
        uint256 timestamp,
        string calldata eventType,
        string calldata market,
        uint32 originChain
    ) external onlyRouter nonReentrant returns (bytes32) {
        if (digest == bytes32(0)) revert InvalidDigest();
        if (actor == address(0)) revert InvalidAddress();
        if (anchors[digest].exists) revert AnchorAlreadyExists();

        anchors[digest] = AnchorRecord({
            digest: digest,
            actor: actor,
            timestamp: timestamp,
            eventType: eventType,
            market: market,
            originChain: originChain,
            exists: true
        });

        totalAnchors++;
        totalRouterAnchors++;

        emit Anchored(
            digest,
            actor,
            timestamp,
            eventType,
            market,
            originChain
        );

        return digest;
    }

    /**
     * @notice Set router authorization
     * @param router Router address
     * @param authorized Whether to authorize or revoke
     */
    function setRouter(address router, bool authorized) external onlyOwner {
        if (router == address(0)) revert InvalidAddress();
        isRouter[router] = authorized;
        emit RouterUpdated(router, authorized);
    }

    /**
     * @notice Set API wallet authorization
     * @param wallet Wallet address
     * @param authorized Whether to authorize or revoke
     */
    function setApiWallet(address wallet, bool authorized) external onlyOwner {
        if (wallet == address(0)) revert InvalidAddress();
        isApiWallet[wallet] = authorized;
        emit ApiWalletUpdated(wallet, authorized);
    }

    /**
     * @notice Verify if an anchor exists
     * @param digest The anchor digest to check
     */
    function verifyAnchor(bytes32 digest) external view returns (bool) {
        return anchors[digest].exists;
    }

    /**
     * @notice Get anchor details
     * @param digest The anchor digest
     */
    function getAnchor(bytes32 digest) external view returns (AnchorRecord memory) {
        require(anchors[digest].exists, "Anchor does not exist");
        return anchors[digest];
    }

    /**
     * @notice Get anchor actor
     * @param digest The anchor digest
     */
    function getActor(bytes32 digest) external view returns (address) {
        require(anchors[digest].exists, "Anchor does not exist");
        return anchors[digest].actor;
    }

    /**
     * @notice Get anchor timestamp
     * @param digest The anchor digest
     */
    function getTimestamp(bytes32 digest) external view returns (uint256) {
        require(anchors[digest].exists, "Anchor does not exist");
        return anchors[digest].timestamp;
    }

    /**
     * @notice Get anchor origin chain
     * @param digest The anchor digest
     */
    function getOriginChain(bytes32 digest) external view returns (uint32) {
        require(anchors[digest].exists, "Anchor does not exist");
        return anchors[digest].originChain;
    }
}
