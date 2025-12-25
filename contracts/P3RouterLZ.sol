// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./P3Treasury.sol";
import "./P3Anchor.sol";

/**
 * @title P3RouterLZ
 * @notice LayerZero receiver for cross-chain fee enforcement and anchoring
 * @dev Receives cross-chain messages and routes to P3Treasury and P3Anchor
 */
contract P3RouterLZ is Ownable, ReentrancyGuard {
    P3Treasury public treasury;
    P3Anchor public anchor;

    mapping(uint32 => bool) public trustedChainIds;
    mapping(uint32 => bytes32) public trustedRemotes;

    address public lzEndpoint;

    uint256 public totalMessagesReceived;
    uint256 public totalFeeSettlements;
    uint256 public totalAnchorings;

    event TrustedChainUpdated(uint32 indexed chainId, bool trusted);
    event TrustedRemoteUpdated(uint32 indexed chainId, bytes32 remote);
    event LzEndpointUpdated(address indexed endpoint);
    event TreasuryUpdated(address indexed treasury);
    event AnchorUpdated(address indexed anchor);
    event MessageReceived(
        uint32 indexed srcChainId,
        bytes32 indexed srcAddress,
        uint64 nonce,
        bytes payload
    );
    event FeeSettlementRelayed(
        bytes32 indexed digest,
        address indexed payer,
        uint256 amount,
        uint32 srcChainId
    );
    event AnchoringRelayed(
        bytes32 indexed digest,
        address indexed actor,
        uint32 srcChainId
    );

    error Unauthorized();
    error InvalidAddress();
    error UntrustedChain();
    error UntrustedRemote();
    error InvalidPayload();
    error SettlementFailed();
    error AnchoringFailed();

    modifier onlyLzEndpoint() {
        if (msg.sender != lzEndpoint) revert Unauthorized();
        _;
    }

    constructor(
        address _treasury,
        address _anchor,
        address _lzEndpoint
    ) Ownable(msg.sender) {
        if (_treasury == address(0)) revert InvalidAddress();
        if (_anchor == address(0)) revert InvalidAddress();
        if (_lzEndpoint == address(0)) revert InvalidAddress();

        treasury = P3Treasury(payable(_treasury));
        anchor = P3Anchor(_anchor);
        lzEndpoint = _lzEndpoint;
    }

    /**
     * @notice LayerZero receive function
     * @dev Called by LayerZero endpoint when message arrives
     * @param _srcChainId Source chain ID
     * @param _srcAddress Source contract address (as bytes)
     * @param _nonce Message nonce
     * @param _payload Encoded message payload
     */
    function lzReceive(
        uint16 _srcChainId,
        bytes calldata _srcAddress,
        uint64 _nonce,
        bytes calldata _payload
    ) external onlyLzEndpoint nonReentrant {
        uint32 srcChainId = uint32(_srcChainId);
        
        if (!trustedChainIds[srcChainId]) revert UntrustedChain();

        bytes32 srcAddressHash = keccak256(_srcAddress);
        if (trustedRemotes[srcChainId] != bytes32(0) && 
            trustedRemotes[srcChainId] != srcAddressHash) {
            revert UntrustedRemote();
        }

        totalMessagesReceived++;

        emit MessageReceived(srcChainId, srcAddressHash, _nonce, _payload);

        _processPayload(_payload, srcChainId);
    }

    /**
     * @notice Process incoming payload
     * @param _payload Encoded payload
     * @param _srcChainId Source chain ID
     */
    function _processPayload(bytes calldata _payload, uint32 _srcChainId) internal {
        if (_payload.length < 1) revert InvalidPayload();

        uint8 messageType = uint8(_payload[0]);

        if (messageType == 1) {
            _processFeeSettlement(_payload[1:], _srcChainId);
        } else if (messageType == 2) {
            _processAnchoring(_payload[1:], _srcChainId);
        } else if (messageType == 3) {
            _processCombined(_payload[1:], _srcChainId);
        } else {
            revert InvalidPayload();
        }
    }

    /**
     * @notice Process fee settlement message
     * @param _data Encoded fee data
     * @param _srcChainId Source chain ID
     */
    function _processFeeSettlement(bytes calldata _data, uint32 _srcChainId) internal {
        (
            bytes32 digest,
            address payer,
            uint256 amount,
            string memory market,
            string memory eventType
        ) = abi.decode(_data, (bytes32, address, uint256, string, string));

        treasury.recordExternalUSDC(digest, payer, amount, market, eventType);
        totalFeeSettlements++;

        emit FeeSettlementRelayed(digest, payer, amount, _srcChainId);
    }

    /**
     * @notice Process anchoring message
     * @param _data Encoded anchor data
     * @param _srcChainId Source chain ID
     */
    function _processAnchoring(bytes calldata _data, uint32 _srcChainId) internal {
        (
            bytes32 digest,
            address actor,
            uint256 timestamp,
            string memory eventType,
            string memory market
        ) = abi.decode(_data, (bytes32, address, uint256, string, string));

        anchor.anchorFromRouter(digest, actor, timestamp, eventType, market, _srcChainId);
        totalAnchorings++;

        emit AnchoringRelayed(digest, actor, _srcChainId);
    }

    /**
     * @notice Process combined fee + anchor message
     * @param _data Encoded combined data
     * @param _srcChainId Source chain ID
     */
    function _processCombined(bytes calldata _data, uint32 _srcChainId) internal {
        (
            bytes32 digest,
            address actor,
            uint256 amount,
            uint256 timestamp,
            string memory market,
            string memory eventType
        ) = abi.decode(_data, (bytes32, address, uint256, uint256, string, string));

        treasury.recordExternalUSDC(digest, actor, amount, market, eventType);
        totalFeeSettlements++;
        emit FeeSettlementRelayed(digest, actor, amount, _srcChainId);

        anchor.anchorFromRouter(digest, actor, timestamp, eventType, market, _srcChainId);
        totalAnchorings++;
        emit AnchoringRelayed(digest, actor, _srcChainId);
    }

    /**
     * @notice Set trusted chain
     * @param chainId Chain ID to trust
     * @param trusted Whether to trust or untrust
     */
    function setTrusted(uint32 chainId, bool trusted) external onlyOwner {
        trustedChainIds[chainId] = trusted;
        emit TrustedChainUpdated(chainId, trusted);
    }

    /**
     * @notice Set trusted remote address for a chain
     * @param chainId Chain ID
     * @param remote Remote address hash
     */
    function setTrustedRemote(uint32 chainId, bytes32 remote) external onlyOwner {
        trustedRemotes[chainId] = remote;
        emit TrustedRemoteUpdated(chainId, remote);
    }

    /**
     * @notice Update LayerZero endpoint
     * @param _lzEndpoint New endpoint address
     */
    function setLzEndpoint(address _lzEndpoint) external onlyOwner {
        if (_lzEndpoint == address(0)) revert InvalidAddress();
        lzEndpoint = _lzEndpoint;
        emit LzEndpointUpdated(_lzEndpoint);
    }

    /**
     * @notice Update treasury contract
     * @param _treasury New treasury address
     */
    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert InvalidAddress();
        treasury = P3Treasury(payable(_treasury));
        emit TreasuryUpdated(_treasury);
    }

    /**
     * @notice Update anchor contract
     * @param _anchor New anchor address
     */
    function setAnchor(address _anchor) external onlyOwner {
        if (_anchor == address(0)) revert InvalidAddress();
        anchor = P3Anchor(_anchor);
        emit AnchorUpdated(_anchor);
    }

    /**
     * @notice Check if chain is trusted
     * @param chainId Chain ID to check
     */
    function isTrustedChain(uint32 chainId) external view returns (bool) {
        return trustedChainIds[chainId];
    }

    /**
     * @notice Get trusted remote for a chain
     * @param chainId Chain ID
     */
    function getTrustedRemote(uint32 chainId) external view returns (bytes32) {
        return trustedRemotes[chainId];
    }

    /**
     * @notice Get statistics
     */
    function getStats() external view returns (
        uint256 messagesReceived,
        uint256 feeSettlements,
        uint256 anchorings
    ) {
        return (totalMessagesReceived, totalFeeSettlements, totalAnchorings);
    }
}
