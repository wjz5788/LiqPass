// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20}          from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20}       from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable}         from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable}        from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title CheckoutUSDC - 简化版结算合约（approve + transferFrom）
/// @notice 责任单一：把保费从买家直接划入 TREASURY，并发 PremiumPaid 事件供后端回填订单
/// @dev 不做订单状态存储；事件即事实。配合后端监听器实现幂等与对账。
contract CheckoutUSDC is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Base USDC 合约（构造时设定后不可变）
    IERC20 public immutable USDC;

    /// @notice 收保费的金库地址（可由 owner 更新）
    address public treasury;

    /// @notice Base主网USDC标准地址（用于验证）
    address public constant BASE_USDC = 0x833589fCD6EdB6E08f4c7C32D4f71B54Bda02913;

    /// @notice Base 主网 chainid
    uint256 public constant BASE_CHAIN_ID = 8453;

    /// @notice USDC精度（6位小数）
    uint256 public constant USDC_DECIMALS = 6;

    /// @notice 订单状态映射，防止重复支付
    mapping(bytes32 => bool) public orderProcessed;

    /// @notice quoteHash有效期映射（秒）
    mapping(bytes32 => uint256) public quoteHashExpiry;

    /// @notice 报价最长有效期，避免误传一个极远的过期时间导致长期可用
    uint256 public constant MAX_QUOTE_TTL = 1 hours;

    /// @dev 下单支付事件
    event PremiumPaid(
        bytes32 indexed orderId,
        address indexed buyer,
        uint256 amount,
        bytes32 indexed quoteHash,
        address token,
        address treasury,
        uint256 chainId,
        uint256 timestamp
    );
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event EmergencyWithdraw(address indexed to, address indexed token, uint256 amount);
    event QuoteHashRegistered(bytes32 indexed quoteHash, uint256 expiryTime);
    event OrderProcessed(bytes32 indexed orderId, address indexed buyer);

    /// @param usdc_ Base 主网 USDC 地址
    /// @param treasury_ 初始金库地址（你控制私钥的地址）
    constructor(address usdc_, address treasury_) Ownable(msg.sender) {
        require(usdc_ != address(0) && treasury_ != address(0), "zero addr");
        // 修复：原先无条件要求 usdc_ == BASE_USDC，等于把合约钉死在 Base 主网，
        // 任何测试网、本地链都无法部署 —— 也就没有办法在上主网前跑通一次完整流程。
        // 现在只在 Base 主网（chainid 8453）上强制校验官方 USDC 地址。
        if (block.chainid == BASE_CHAIN_ID) {
            require(usdc_ == BASE_USDC, "invalid usdc address");
        }
        USDC = IERC20(usdc_);
        treasury = treasury_;
    }

    /// @notice 更新金库地址（热切换，无需停机）
    function updateTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "zero addr");
        address old = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(old, newTreasury);
    }

    /// @notice 管理暂停/恢复（前端据此禁用支付按钮）
    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /// @notice 由「买家 + 订单号 + 金额」唯一确定的报价承诺
    /// @dev 修复：原设计里 quoteHash 是一个和订单无关的裸哈希，
    ///      而 registerQuoteHash 又会公开 emit 出来。任何人都能抄走一个
    ///      尚未过期的 quoteHash，用**自己的** orderId 和**任意**金额调用
    ///      buyPolicy —— 报价里承诺的买家/金额/金库完全没有被强制执行。
    ///      现在 quoteHash 必须等于对 (buyer, orderId, amount) 的承诺。
    function quoteCommitment(address buyer, bytes32 orderId, uint256 amount)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(buyer, orderId, amount));
    }

    /// @notice 注册quoteHash并设置有效期
    /// @param quoteHash 必须由 quoteCommitment(buyer, orderId, amount) 计算得到
    /// @param expiryTime 过期时间（Unix时间戳）
    function registerQuoteHash(bytes32 quoteHash, uint256 expiryTime) public onlyOwner {
        require(quoteHash != bytes32(0), "zero quote hash");
        require(expiryTime > block.timestamp, "invalid expiry time");
        require(expiryTime <= block.timestamp + MAX_QUOTE_TTL, "expiry too far");
        quoteHashExpiry[quoteHash] = expiryTime;
        emit QuoteHashRegistered(quoteHash, expiryTime);
    }

    /// @notice 便捷入口：直接按 (buyer, orderId, amount) 注册报价
    function registerQuote(address buyer, bytes32 orderId, uint256 amount, uint256 expiryTime)
        external
        onlyOwner
        returns (bytes32 quoteHash)
    {
        quoteHash = quoteCommitment(buyer, orderId, amount);
        registerQuoteHash(quoteHash, expiryTime);
    }

    /// @notice 验证quoteHash是否有效
    /// @param quoteHash 要验证的报价哈希
    function isValidQuoteHash(bytes32 quoteHash) public view returns (bool) {
        return quoteHashExpiry[quoteHash] > block.timestamp;
    }

    /// @notice 单笔支付上限（micro-USDC），与链下业务规则一致，可由 owner 调整
    uint256 public maxAmount = 100 * (10 ** USDC_DECIMALS); // 100 USDC

    /// @notice 单笔支付下限（micro-USDC）
    uint256 public minAmount = 10_000; // 0.01 USDC

    event AmountLimitsUpdated(uint256 minAmount, uint256 maxAmount);

    function setAmountLimits(uint256 newMin, uint256 newMax) external onlyOwner {
        require(newMin > 0 && newMin <= newMax, "invalid limits");
        minAmount = newMin;
        maxAmount = newMax;
        emit AmountLimitsUpdated(newMin, newMax);
    }

    /// @notice 验证USDC金额是否有效
    /// @dev 修复：原实现写的是 `amount % 1e6 == 0`，即只接受**整数个 USDC**，
    ///      与 USDC_AMOUNT_RULES.md 里「步长 1e-6、最小 0.01 USDC」的规则直接冲突，
    ///      也导致后端算出的任何带小数的保费（绝大多数）在链上必然 revert。
    ///      USDC 本身就是 6 位精度，链上金额已经是最小单位整数，无需再取模。
    /// @param amount 要验证的金额（micro-USDC）
    function isValidAmount(uint256 amount) public view returns (bool) {
        return amount >= minAmount && amount <= maxAmount;
    }

    /// @notice 验证金额
    /// @param amount 要验证的金额（micro-USDC）
    function validateAndNormalizeAmount(uint256 amount) public view returns (uint256) {
        require(isValidAmount(amount), "invalid amount");
        return amount;
    }

    /// @notice 用户先对 USDC 执行 approve(CheckoutUSDC, amount)，再调用本函数完成支付
    /// @param orderId   订单ID（建议 keccak(UUID)，传 bytes32）
    /// @param amount    USDC 数量（6 位精度）
    /// @param quoteHash 报价承诺，必须等于 quoteCommitment(msg.sender, orderId, amount)
    ///                  且由 owner 通过 registerQuote / registerQuoteHash 预先注册
    function buyPolicy(bytes32 orderId, uint256 amount, bytes32 quoteHash)
        external
        nonReentrant
        whenNotPaused
    {
        // 验证订单是否已处理
        require(!orderProcessed[orderId], "order already processed");

        // 验证金额
        uint256 normalizedAmount = validateAndNormalizeAmount(amount);

        // 修复：quoteHash 必须与本次 (买家, 订单号, 金额) 严格绑定，
        // 防止盗用他人报价或改价支付
        require(
            quoteHash == quoteCommitment(msg.sender, orderId, normalizedAmount),
            "quote hash not bound to this purchase"
        );
        require(isValidQuoteHash(quoteHash), "invalid or expired quote hash");

        // 标记订单为已处理，并作废该报价（一次性使用）
        orderProcessed[orderId] = true;
        delete quoteHashExpiry[quoteHash];
        
        // 直接转入金库，不在合约囤资
        USDC.safeTransferFrom(msg.sender, treasury, normalizedAmount);
        
        // 发出支付事件
        emit PremiumPaid(
            orderId,
            msg.sender,
            normalizedAmount,
            quoteHash,
            address(USDC),
            treasury,
            block.chainid,
            block.timestamp
        );
        emit OrderProcessed(orderId, msg.sender);
    }

    /// @notice 安全兜底：若有误存代币，可由 owner 取回（不含 ETH）
    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "zero to");
        require(token != address(USDC), "cannot withdraw USDC");
        IERC20(token).safeTransfer(to, amount);         // ✅ 使用 SafeERC20
        emit EmergencyWithdraw(to, token, amount);
    }

    /// @notice 检查订单是否已处理
    /// @param orderId 订单ID
    function isOrderProcessed(bytes32 orderId) external view returns (bool) {
        return orderProcessed[orderId];
    }

    /// @notice 获取quoteHash过期时间
    /// @param quoteHash 报价哈希
    function getQuoteHashExpiry(bytes32 quoteHash) external view returns (uint256) {
        return quoteHashExpiry[quoteHash];
    }

    /// @notice 获取合约信息
    function getContractInfo() external view returns (
        address usdcAddress,
        address treasuryAddress,
        uint256 usdcDecimals,
        bool paused
    ) {
        return (
            address(USDC),
            treasury,
            USDC_DECIMALS,
            paused()
        );
    }

    /// @notice 拒收 ETH（防误转）
    receive() external payable { revert("no-eth"); }    // ✅
    fallback() external payable { revert("no-eth"); }   // ✅

    /// @notice 合约版本标识（便于前端/后端校验）
    function version() external pure returns (string memory) {
        return "checkout-usdc/1.1.0";                  // quoteHash 绑定 + 金额规则修复
    }
}