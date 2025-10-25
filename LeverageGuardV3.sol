// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title LeverageGuardV3
 * @dev 支持Permit2的USDC支付保险合约
 * 实现订单去重机制和金额校验
 */
contract LeverageGuardV3 is ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // USDC地址（Base主网）
    address public constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    
    // Permit2合约地址（多链统一）
    address public constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    
    // 合约所有者
    address public owner;
    
    // 订单去重映射
    mapping(bytes32 => bool) public orderExecuted;
    
    // 事件
    event OrderCreated(
        bytes32 indexed orderId,
        address indexed buyer,
        uint256 amount,
        string paymentMethod
    );
    
    event PaymentProcessed(
        bytes32 indexed orderId,
        address indexed buyer,
        uint256 amount,
        string paymentMethod
    );
    
    // Permit2数据结构
    struct PermitTransferFrom {
        address token;
        uint256 amount;
        uint256 nonce;
        uint256 deadline;
    }
    
    struct Signature {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @dev 使用Permit2进行支付
     * @param orderId 订单ID（用于去重）
     * @param permit Permit2授权数据
     * @param sig 签名数据
     * @param amount 支付金额（6位小数）
     */
    function buyWithPermit2(
        bytes32 orderId,
        PermitTransferFrom calldata permit,
        Signature calldata sig,
        uint256 amount
    ) external nonReentrant {
        // 订单去重检查
        require(!orderExecuted[orderId], "Order already executed");
        
        // 金额校验
        require(amount > 0, "Invalid amount");
        require(amount <= permit.amount, "Amount exceeds permitted limit");
        
        // 代币校验
        require(permit.token == USDC, "Invalid token");
        
        // 截止时间校验
        require(permit.deadline >= block.timestamp, "Permit expired");
        
        // 调用Permit2合约进行转账
        (bool success, ) = PERMIT2.call(
            abi.encodeWithSignature(
                "transferFrom(address,address,uint256,address,bytes)",
                msg.sender,
                address(this),
                amount,
                permit.token,
                abi.encode(permit.nonce, permit.deadline, sig.v, sig.r, sig.s)
            )
        );
        
        require(success, "Permit2 transfer failed");
        
        // 标记订单为已执行
        orderExecuted[orderId] = true;
        
        emit PaymentProcessed(orderId, msg.sender, amount, "permit2");
        emit OrderCreated(orderId, msg.sender, amount, "permit2");
    }
    
    /**
     * @dev 使用传统USDC支付（回退方案）
     * @param orderId 订单ID（用于去重）
     * @param amount 支付金额（6位小数）
     */
    function buyWithUSDC(
        bytes32 orderId,
        uint256 amount
    ) external nonReentrant {
        // 订单去重检查
        require(!orderExecuted[orderId], "Order already executed");
        
        // 金额校验
        require(amount > 0, "Invalid amount");
        
        // USDC转账
        IERC20 usdc = IERC20(USDC);
        
        // 检查用户余额
        require(usdc.balanceOf(msg.sender) >= amount, "Insufficient USDC balance");
        
        // 检查授权额度
        require(usdc.allowance(msg.sender, address(this)) >= amount, "Insufficient allowance");
        
        // 执行转账
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        
        // 标记订单为已执行
        orderExecuted[orderId] = true;
        
        emit PaymentProcessed(orderId, msg.sender, amount, "usdc");
        emit OrderCreated(orderId, msg.sender, amount, "usdc");
    }
    
    /**
     * @dev 检查订单是否已执行
     * @param orderId 订单ID
     * @return 是否已执行
     */
    function isOrderExecuted(bytes32 orderId) external view returns (bool) {
        return orderExecuted[orderId];
    }
    
    /**
     * @dev 提取合约中的USDC（仅限所有者）
     * @param to 收款地址
     * @param amount 提取金额
     */
    function withdrawUSDC(address to, uint256 amount) external {
        require(msg.sender == owner, "Only owner can withdraw");
        require(to != address(0), "Invalid recipient");
        
        IERC20 usdc = IERC20(USDC);
        require(usdc.balanceOf(address(this)) >= amount, "Insufficient contract balance");
        
        usdc.safeTransfer(to, amount);
    }
    
    /**
     * @dev 获取合约USDC余额
     * @return 余额
     */
    function getContractBalance() external view returns (uint256) {
        return IERC20(USDC).balanceOf(address(this));
    }
    
    /**
     * @dev 生成订单ID（前端可调用）
     * @param buyer 买家地址
     * @param nonce 随机数
     * @return 订单ID
     */
    function generateOrderId(address buyer, uint256 nonce) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(buyer, nonce));
    }
}