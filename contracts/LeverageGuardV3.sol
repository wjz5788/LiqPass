// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// =========================
// 🔹 Permit2 接口
// =========================
interface IPermit2 {
    struct TokenPermissions {
        address token;
        uint256 amount;
    }

    struct PermitTransferFrom {
        TokenPermissions permitted;
        uint256 nonce;
        uint256 deadline;
    }

    function permitTransferFrom(PermitTransferFrom calldata permit, bytes calldata signature) external;
}


/**
 * @title LeverageGuardV3 - 支持Permit2的USDC支付智能合约
 * @author LiqPass Team
 * @notice 集成Uniswap Permit2和OpenZeppelin SafeERC20的杠杆交易保险合约
 * @dev 实现两种支付方式：Permit2一次签名直付和传统的approve+transferFrom回退
 */
contract LeverageGuardV3 is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =========================
    // 🔹 Permit2 相关数据结构
    // =========================
    struct TokenPermissions {
        address token;
        uint256 amount;
    }

    /// @notice Permit2 签名中包含的详细信息
    /// @dev 这个结构体需要与前端签名的数据结构匹配
    struct PermitData {
        TokenPermissions permitted;
        address spender;
        uint256 nonce;
        uint256 deadline;
    }

    // =========================
    // 🔹 事件定义
    // =========================
    event OrderCreated(bytes32 indexed orderId, address indexed user, uint256 amount);
    event PaymentWithPermit2(bytes32 indexed orderId, address indexed user, uint256 amount);
    event PaymentWithUSDC(bytes32 indexed orderId, address indexed user, uint256 amount);
    event Payout(address indexed user, uint256 amount);
    event FundsAdded(address indexed owner, uint256 amount);
    event Withdrawal(address indexed owner, uint256 amount);

    // =========================
    // 🔹 状态变量
    // =========================
    address public owner;
    
    address public constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address public constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    
    mapping(bytes32 => bool) public orderExecuted;
    uint256 public contractBalance;

    // =========================
    // 🔹 修饰器
    // =========================
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // =========================
    // 🔹 构造函数
    // =========================
    constructor() {
        owner = msg.sender;
    }

    // =========================
    // 🔹 核心购买方法
    // =========================

    /**
     * @notice 使用Permit2进行USDC支付购买
     * @param orderId 订单ID（用于去重）
     * @param permitData Permit2许可的详细数据
     * @param sig 用户的EIP-712签名
     */
    function buyWithPermit2(
        bytes32 orderId,
        PermitData calldata permitData,
        bytes calldata sig
    ) external nonReentrant {
        require(!orderExecuted[orderId], "Order already executed");
        require(permitData.permitted.token == USDC, "Invalid token");
        require(permitData.spender == address(this), "Invalid spender");
        require(permitData.permitted.amount > 0, "Amount must be > 0");
        require(permitData.deadline >= block.timestamp, "Permit expired");
        
        _executePermit2Transfer(permitData, sig);
        
        orderExecuted[orderId] = true;
        contractBalance += permitData.permitted.amount;
        
        emit OrderCreated(orderId, msg.sender, permitData.permitted.amount);
        emit PaymentWithPermit2(orderId, msg.sender, permitData.permitted.amount);
    }

    /**
     * @notice 使用传统approve+transferFrom进行USDC支付购买
     */
    function buyWithUSDC(
        bytes32 orderId,
        uint256 amount
    ) external nonReentrant {
        require(!orderExecuted[orderId], "Order already executed");
        require(amount > 0, "Amount must be > 0");
        
        IERC20(USDC).safeTransferFrom(msg.sender, address(this), amount);
        
        orderExecuted[orderId] = true;
        contractBalance += amount;
        
        emit OrderCreated(orderId, msg.sender, amount);
        emit PaymentWithUSDC(orderId, msg.sender, amount);
    }

    // =========================
    // 🔹 内部方法
    // =========================

    function _executePermit2Transfer(
        PermitData calldata permitData,
        bytes calldata sig
    ) internal {
        IPermit2.PermitTransferFrom memory permitToRelay = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({
                token: permitData.permitted.token,
                amount: permitData.permitted.amount
            }),
            nonce: permitData.nonce,
            deadline: permitData.deadline
        });

        IPermit2(PERMIT2).permitTransferFrom(permitToRelay, sig);
    }

    // =========================
    // 🔹 资金管理
    // =========================

    /**
     * @notice 添加资金到合约
     */
    function addFunds() external payable onlyOwner {
        contractBalance += msg.value;
        emit FundsAdded(msg.sender, msg.value);
    }

    /**
     * @notice 提取合约资金
     * @param _amount 提取金额
     */
    function withdraw(uint256 _amount) external onlyOwner nonReentrant {
        require(_amount <= contractBalance, "Insufficient contract balance");
        contractBalance -= _amount;
        
        // 提取ETH
        if (address(this).balance >= _amount) {
            (bool success, ) = owner.call{value: _amount}("");
            require(success, "ETH withdrawal failed");
        } else {
            // 提取USDC
            IERC20 usdc = IERC20(USDC);
            uint256 usdcBalance = usdc.balanceOf(address(this));
            require(usdcBalance >= _amount, "Insufficient USDC balance");
            usdc.safeTransfer(owner, _amount);
        }
        
        emit Withdrawal(owner, _amount);
    }

    /**
     * @notice 执行赔付
     * @param _user 赔付接收者
     * @param _amount 赔付金额（6位小数）
     */
    function executePayout(address _user, uint256 _amount) external onlyOwner nonReentrant {
        require(_amount > 0, "Amount must be > 0");
        require(_amount <= contractBalance, "Insufficient contract balance");
        
        IERC20 usdc = IERC20(USDC);
        uint256 usdcBalance = usdc.balanceOf(address(this));
        require(usdcBalance >= _amount, "Insufficient USDC balance");
        
        usdc.safeTransfer(_user, _amount);
        contractBalance -= _amount;
        
        emit Payout(_user, _amount);
    }

    // =========================
    // 🔹 视图方法
    // =========================

    /**
     * @notice 获取合约USDC余额
     * @return USDC余额（6位小数）
     */
    function getUSDCBalance() external view returns (uint256) {
        IERC20 usdc = IERC20(USDC);
        return usdc.balanceOf(address(this));
    }

    /**
     * @notice 检查订单是否已执行
     * @param orderId 订单ID
     * @return 是否已执行
     */
    function isOrderExecuted(bytes32 orderId) external view returns (bool) {
        return orderExecuted[orderId];
    }

    /**
     * @notice 获取合约信息
     * @return owner地址、USDC余额、ETH余额
     */
    function getContractInfo() external view returns (address, uint256, uint256) {
        IERC20 usdc = IERC20(USDC);
        return (owner, usdc.balanceOf(address(this)), address(this).balance);
    }
}
