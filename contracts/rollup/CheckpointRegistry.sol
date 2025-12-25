// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CheckpointRegistry
 * @notice L1 checkpoint registry for L3 rollup state
 * @dev Stores periodic checkpoints of L2 state and DAO governance state
 */
contract CheckpointRegistry is Ownable, ReentrancyGuard {
    struct Checkpoint {
        bytes32 l2Root;
        bytes32 daoStateRoot;
        uint256 timestamp;
        address submitter;
        uint256 blockNumber;
        string metadata;
        bool finalized;
    }

    mapping(bytes32 => Checkpoint) public checkpoints;
    mapping(bytes32 => bool) public checkpointExists;
    
    bytes32[] public checkpointHistory;
    mapping(address => bool) public authorizedSubmitters;
    
    uint256 public totalCheckpoints;
    uint256 public finalizationDelay = 1 hours;
    bytes32 public latestCheckpoint;

    event CheckpointSubmitted(
        bytes32 indexed checkpointId,
        bytes32 l2Root,
        bytes32 daoStateRoot,
        address indexed submitter,
        uint256 timestamp
    );

    event CheckpointFinalized(
        bytes32 indexed checkpointId,
        uint256 timestamp
    );

    event SubmitterAuthorized(address indexed submitter);
    event SubmitterRevoked(address indexed submitter);
    event FinalizationDelayUpdated(uint256 oldDelay, uint256 newDelay);

    modifier onlyAuthorized() {
        require(
            authorizedSubmitters[msg.sender] || msg.sender == owner(),
            "Not authorized to submit checkpoints"
        );
        _;
    }

    constructor() Ownable(msg.sender) {
        authorizedSubmitters[msg.sender] = true;
    }

    /**
     * @notice Submit a new checkpoint to L1
     * @param l2Root Merkle root of L2 state
     * @param daoStateRoot Root hash of DAO governance state
     * @param metadata Additional metadata (JSON string)
     */
    function submitCheckpoint(
        bytes32 l2Root,
        bytes32 daoStateRoot,
        string calldata metadata
    ) external nonReentrant onlyAuthorized returns (bytes32) {
        require(l2Root != bytes32(0), "Invalid L2 root");
        require(daoStateRoot != bytes32(0), "Invalid DAO state root");

        bytes32 checkpointId = keccak256(
            abi.encodePacked(
                l2Root,
                daoStateRoot,
                msg.sender,
                block.timestamp,
                block.number
            )
        );

        require(!checkpointExists[checkpointId], "Checkpoint already exists");

        checkpoints[checkpointId] = Checkpoint({
            l2Root: l2Root,
            daoStateRoot: daoStateRoot,
            timestamp: block.timestamp,
            submitter: msg.sender,
            blockNumber: block.number,
            metadata: metadata,
            finalized: false
        });

        checkpointExists[checkpointId] = true;
        checkpointHistory.push(checkpointId);
        latestCheckpoint = checkpointId;
        totalCheckpoints++;

        emit CheckpointSubmitted(
            checkpointId,
            l2Root,
            daoStateRoot,
            msg.sender,
            block.timestamp
        );

        return checkpointId;
    }

    /**
     * @notice Finalize a checkpoint after the delay period
     * @param checkpointId The checkpoint ID to finalize
     */
    function finalizeCheckpoint(bytes32 checkpointId) external nonReentrant {
        require(checkpointExists[checkpointId], "Checkpoint does not exist");
        Checkpoint storage checkpoint = checkpoints[checkpointId];
        require(!checkpoint.finalized, "Checkpoint already finalized");
        require(
            block.timestamp >= checkpoint.timestamp + finalizationDelay,
            "Finalization delay not passed"
        );

        checkpoint.finalized = true;

        emit CheckpointFinalized(checkpointId, block.timestamp);
    }

    /**
     * @notice Get checkpoint details
     * @param checkpointId The checkpoint ID
     */
    function getCheckpoint(bytes32 checkpointId)
        external
        view
        returns (Checkpoint memory)
    {
        require(checkpointExists[checkpointId], "Checkpoint does not exist");
        return checkpoints[checkpointId];
    }

    /**
     * @notice Get the latest checkpoint
     */
    function getLatestCheckpoint() external view returns (Checkpoint memory) {
        require(latestCheckpoint != bytes32(0), "No checkpoints exist");
        return checkpoints[latestCheckpoint];
    }

    /**
     * @notice Get checkpoint history
     * @param offset Starting index
     * @param limit Number of checkpoints to return
     */
    function getCheckpointHistory(uint256 offset, uint256 limit)
        external
        view
        returns (bytes32[] memory)
    {
        require(offset < checkpointHistory.length, "Offset out of bounds");
        
        uint256 end = offset + limit;
        if (end > checkpointHistory.length) {
            end = checkpointHistory.length;
        }
        
        uint256 resultLength = end - offset;
        bytes32[] memory result = new bytes32[](resultLength);
        
        for (uint256 i = 0; i < resultLength; i++) {
            result[i] = checkpointHistory[checkpointHistory.length - 1 - (offset + i)];
        }
        
        return result;
    }

    /**
     * @notice Verify if a checkpoint is finalized
     * @param checkpointId The checkpoint ID to verify
     */
    function isCheckpointFinalized(bytes32 checkpointId)
        external
        view
        returns (bool)
    {
        if (!checkpointExists[checkpointId]) {
            return false;
        }
        return checkpoints[checkpointId].finalized;
    }

    /**
     * @notice Authorize a submitter
     * @param submitter Address to authorize
     */
    function authorizeSubmitter(address submitter) external onlyOwner {
        require(submitter != address(0), "Invalid address");
        require(!authorizedSubmitters[submitter], "Already authorized");
        
        authorizedSubmitters[submitter] = true;
        emit SubmitterAuthorized(submitter);
    }

    /**
     * @notice Revoke a submitter's authorization
     * @param submitter Address to revoke
     */
    function revokeSubmitter(address submitter) external onlyOwner {
        require(authorizedSubmitters[submitter], "Not authorized");
        
        authorizedSubmitters[submitter] = false;
        emit SubmitterRevoked(submitter);
    }

    /**
     * @notice Update the finalization delay
     * @param newDelay New delay in seconds
     */
    function setFinalizationDelay(uint256 newDelay) external onlyOwner {
        require(newDelay > 0, "Delay must be positive");
        require(newDelay <= 7 days, "Delay too long");
        
        uint256 oldDelay = finalizationDelay;
        finalizationDelay = newDelay;
        
        emit FinalizationDelayUpdated(oldDelay, newDelay);
    }

    /**
     * @notice Get total number of checkpoints
     */
    function getCheckpointCount() external view returns (uint256) {
        return totalCheckpoints;
    }
}
