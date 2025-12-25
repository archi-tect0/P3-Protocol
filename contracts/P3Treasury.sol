// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title P3Treasury
 * @notice Cross-chain fee enforcement treasury for P3 Protocol
 * @dev Manages fee settlements from routers and API wallets with multi-chain support
 */
contract P3Treasury is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    address public payoutRecipient;

    mapping(address => bool) public isRouter;
    mapping(address => bool) public isApiWallet;

    uint256 public totalUsdcSettled;
    uint256 public totalNativeSettled;
    uint256 public totalExternalUsdcRecorded;

    event FeeSettled(
        bytes32 indexed digest,
        address indexed payer,
        uint256 amount,
        string currency,
        string market,
        string eventType
    );

    event RouterUpdated(address indexed router, bool authorized);
    event ApiWalletUpdated(address indexed wallet, bool authorized);
    event PayoutRecipientUpdated(address indexed recipient);
    event Payout(address indexed recipient, address indexed token, uint256 amount);

    error Unauthorized();
    error InvalidAddress();
    error InvalidAmount();
    error InsufficientBalance();
    error TransferFailed();

    modifier onlyRouter() {
        if (!isRouter[msg.sender]) revert Unauthorized();
        _;
    }

    modifier onlyApiWallet() {
        if (!isApiWallet[msg.sender]) revert Unauthorized();
        _;
    }

    modifier onlyRouterOrApiWallet() {
        if (!isRouter[msg.sender] && !isApiWallet[msg.sender]) revert Unauthorized();
        _;
    }

    constructor(address _usdc, address _payoutRecipient) Ownable(msg.sender) {
        if (_usdc == address(0)) revert InvalidAddress();
        if (_payoutRecipient == address(0)) revert InvalidAddress();
        
        usdc = IERC20(_usdc);
        payoutRecipient = _payoutRecipient;
    }

    /**
     * @notice Receive ETH deposits
     */
    receive() external payable {}

    /**
     * @notice Settle fee in USDC
     * @param digest Event digest hash
     * @param amount USDC amount (6 decimals)
     * @param market Market identifier
     * @param eventType Type of event being settled
     */
    function settleFeeUSDC(
        bytes32 digest,
        uint256 amount,
        string calldata market,
        string calldata eventType
    ) external onlyRouterOrApiWallet nonReentrant {
        if (amount == 0) revert InvalidAmount();

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        totalUsdcSettled += amount;

        emit FeeSettled(digest, msg.sender, amount, "USDC", market, eventType);
    }

    /**
     * @notice Settle fee in native currency (ETH) and forward to payout recipient
     * @param digest Event digest hash
     * @param market Market identifier
     * @param eventType Type of event being settled
     */
    function settleFeeNative(
        bytes32 digest,
        string calldata market,
        string calldata eventType
    ) external payable onlyRouterOrApiWallet nonReentrant {
        if (msg.value == 0) revert InvalidAmount();

        totalNativeSettled += msg.value;

        (bool success, ) = payoutRecipient.call{value: msg.value}("");
        if (!success) revert TransferFailed();

        emit FeeSettled(digest, msg.sender, msg.value, "ETH", market, eventType);
    }

    /**
     * @notice Record external USDC settlement from cross-chain relay
     * @dev Called by routers to record fees settled on other chains
     * @param digest Event digest hash
     * @param payer Original payer address
     * @param amount USDC amount settled
     * @param market Market identifier
     * @param eventType Type of event being settled
     */
    function recordExternalUSDC(
        bytes32 digest,
        address payer,
        uint256 amount,
        string calldata market,
        string calldata eventType
    ) external onlyRouter nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (payer == address(0)) revert InvalidAddress();

        totalExternalUsdcRecorded += amount;

        emit FeeSettled(digest, payer, amount, "USDC_EXTERNAL", market, eventType);
    }

    /**
     * @notice Payout accumulated funds to recipient
     * @param token Token address (address(0) for ETH)
     * @param amount Amount to payout
     */
    function payout(address token, uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert InvalidAmount();

        if (token == address(0)) {
            if (address(this).balance < amount) revert InsufficientBalance();
            (bool success, ) = payoutRecipient.call{value: amount}("");
            if (!success) revert TransferFailed();
        } else {
            if (IERC20(token).balanceOf(address(this)) < amount) revert InsufficientBalance();
            IERC20(token).safeTransfer(payoutRecipient, amount);
        }

        emit Payout(payoutRecipient, token, amount);
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
     * @notice Update payout recipient
     * @param recipient New payout recipient address
     */
    function setPayoutRecipient(address recipient) external onlyOwner {
        if (recipient == address(0)) revert InvalidAddress();
        payoutRecipient = recipient;
        emit PayoutRecipientUpdated(recipient);
    }

    /**
     * @notice Get treasury ETH balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Get treasury USDC balance
     */
    function getUsdcBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /**
     * @notice Get treasury token balance
     * @param token Token address
     */
    function getTokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}
