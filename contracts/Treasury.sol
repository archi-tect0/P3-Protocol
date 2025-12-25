// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title Treasury
 * @notice DAO-controlled treasury for P3 Protocol
 * @dev Manages protocol funds with multi-signature and governance control
 */
contract Treasury is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Proposal {
        address recipient;
        uint256 amount;
        address token;
        string description;
        bool executed;
        uint256 timestamp;
    }

    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;

    event Deposit(address indexed sender, uint256 amount, uint256 timestamp);
    event TokenDeposit(
        address indexed sender,
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed recipient,
        uint256 amount,
        address token
    );
    event ProposalExecuted(uint256 indexed proposalId, address indexed executor);
    event Withdrawal(
        address indexed recipient,
        uint256 amount,
        address indexed token
    );

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Receive ETH deposits
     */
    receive() external payable {
        emit Deposit(msg.sender, msg.value, block.timestamp);
    }

    /**
     * @notice Deposit ERC20 tokens
     * @param token Token address
     * @param amount Amount to deposit
     */
    function depositToken(address token, uint256 amount) external nonReentrant {
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Amount must be positive");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit TokenDeposit(msg.sender, token, amount, block.timestamp);
    }

    /**
     * @notice Create a withdrawal proposal
     * @param recipient Recipient address
     * @param amount Amount to withdraw
     * @param token Token address (address(0) for ETH)
     * @param description Proposal description
     */
    function createProposal(
        address recipient,
        uint256 amount,
        address token,
        string calldata description
    ) external onlyOwner returns (uint256) {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be positive");

        proposalCount++;
        uint256 proposalId = proposalCount;

        proposals[proposalId] = Proposal({
            recipient: recipient,
            amount: amount,
            token: token,
            description: description,
            executed: false,
            timestamp: block.timestamp
        });

        emit ProposalCreated(proposalId, recipient, amount, token);

        return proposalId;
    }

    /**
     * @notice Execute a withdrawal proposal
     * @param proposalId Proposal ID
     */
    function executeProposal(uint256 proposalId) external onlyOwner nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.timestamp > 0, "Proposal does not exist");
        require(!proposal.executed, "Proposal already executed");

        proposal.executed = true;

        if (proposal.token == address(0)) {
            // ETH withdrawal
            require(address(this).balance >= proposal.amount, "Insufficient ETH balance");
            (bool success, ) = proposal.recipient.call{value: proposal.amount}("");
            require(success, "ETH transfer failed");
        } else {
            // ERC20 withdrawal
            IERC20 token = IERC20(proposal.token);
            require(
                token.balanceOf(address(this)) >= proposal.amount,
                "Insufficient token balance"
            );
            token.safeTransfer(proposal.recipient, proposal.amount);
        }

        emit ProposalExecuted(proposalId, msg.sender);
        emit Withdrawal(proposal.recipient, proposal.amount, proposal.token);
    }

    /**
     * @notice Get treasury ETH balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Get treasury token balance
     * @param token Token address
     */
    function getTokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    /**
     * @notice Get proposal details
     * @param proposalId Proposal ID
     */
    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return proposals[proposalId];
    }
}
