// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SwapHubDEX
 * @dev Simple DEX contract for token swaps
 * Features:
 * - Token to Token swaps
 * - ETH to Token swaps
 * - Token to ETH swaps
 * - Liquidity provision
 * - Fee collection
 */
contract SwapHubDEX is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Fee percentage (in basis points, 100 = 1%)
    uint256 public swapFee = 30; // 0.3%
    uint256 public constant FEE_DENOMINATOR = 10000;

    // Supported tokens
    mapping(address => bool) public supportedTokens;
    address[] public tokenList;

    // Liquidity pools: token => amount
    mapping(address => uint256) public tokenLiquidity;
    uint256 public ethLiquidity;

    // Liquidity provider shares
    mapping(address => mapping(address => uint256)) public liquidityShares; // user => token => shares
    mapping(address => uint256) public totalShares; // token => total shares

    // Price oracle (simplified - in production use Chainlink)
    mapping(address => uint256) public tokenPriceInWei; // token => price in wei per token

    // Events
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
    event Swap(
        address indexed user,
        address indexed fromToken,
        address indexed toToken,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee
    );
    event LiquidityAdded(address indexed provider, address indexed token, uint256 amount, uint256 shares);
    event LiquidityRemoved(address indexed provider, address indexed token, uint256 amount, uint256 shares);
    event PriceUpdated(address indexed token, uint256 newPrice);
    event FeeUpdated(uint256 newFee);

    constructor() Ownable(msg.sender) {}

    // ============ Admin Functions ============

    /**
     * @dev Add a supported token
     */
    function addToken(address token, uint256 initialPriceInWei) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(!supportedTokens[token], "Token already supported");
        
        supportedTokens[token] = true;
        tokenList.push(token);
        tokenPriceInWei[token] = initialPriceInWei;
        
        emit TokenAdded(token);
    }

    /**
     * @dev Update token price (simplified oracle)
     */
    function setTokenPrice(address token, uint256 priceInWei) external onlyOwner {
        require(supportedTokens[token], "Token not supported");
        tokenPriceInWei[token] = priceInWei;
        emit PriceUpdated(token, priceInWei);
    }

    /**
     * @dev Update swap fee
     */
    function setSwapFee(uint256 newFee) external onlyOwner {
        require(newFee <= 500, "Fee too high"); // Max 5%
        swapFee = newFee;
        emit FeeUpdated(newFee);
    }

    // ============ Liquidity Functions ============

    /**
     * @dev Add ETH liquidity
     */
    function addEthLiquidity() external payable nonReentrant {
        require(msg.value > 0, "Must send ETH");
        
        uint256 shares;
        if (ethLiquidity == 0) {
            shares = msg.value;
        } else {
            shares = (msg.value * totalShares[address(0)]) / ethLiquidity;
        }
        
        ethLiquidity += msg.value;
        liquidityShares[msg.sender][address(0)] += shares;
        totalShares[address(0)] += shares;
        
        emit LiquidityAdded(msg.sender, address(0), msg.value, shares);
    }

    /**
     * @dev Add token liquidity
     */
    function addTokenLiquidity(address token, uint256 amount) external nonReentrant {
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Amount must be > 0");
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        uint256 shares;
        if (tokenLiquidity[token] == 0) {
            shares = amount;
        } else {
            shares = (amount * totalShares[token]) / tokenLiquidity[token];
        }
        
        tokenLiquidity[token] += amount;
        liquidityShares[msg.sender][token] += shares;
        totalShares[token] += shares;
        
        emit LiquidityAdded(msg.sender, token, amount, shares);
    }

    /**
     * @dev Remove ETH liquidity
     */
    function removeEthLiquidity(uint256 shares) external nonReentrant {
        require(shares > 0 && shares <= liquidityShares[msg.sender][address(0)], "Invalid shares");
        
        uint256 ethAmount = (shares * ethLiquidity) / totalShares[address(0)];
        
        liquidityShares[msg.sender][address(0)] -= shares;
        totalShares[address(0)] -= shares;
        ethLiquidity -= ethAmount;
        
        (bool success, ) = msg.sender.call{value: ethAmount}("");
        require(success, "ETH transfer failed");
        
        emit LiquidityRemoved(msg.sender, address(0), ethAmount, shares);
    }

    /**
     * @dev Remove token liquidity
     */
    function removeTokenLiquidity(address token, uint256 shares) external nonReentrant {
        require(supportedTokens[token], "Token not supported");
        require(shares > 0 && shares <= liquidityShares[msg.sender][token], "Invalid shares");
        
        uint256 tokenAmount = (shares * tokenLiquidity[token]) / totalShares[token];
        
        liquidityShares[msg.sender][token] -= shares;
        totalShares[token] -= shares;
        tokenLiquidity[token] -= tokenAmount;
        
        IERC20(token).safeTransfer(msg.sender, tokenAmount);
        
        emit LiquidityRemoved(msg.sender, token, tokenAmount, shares);
    }

    // ============ Swap Functions ============

    /**
     * @dev Swap ETH for tokens
     */
    function swapETHForToken(address toToken, uint256 minAmountOut) external payable nonReentrant {
        require(supportedTokens[toToken], "Token not supported");
        require(msg.value > 0, "Must send ETH");
        require(tokenLiquidity[toToken] > 0, "Insufficient liquidity");

        uint256 fee = (msg.value * swapFee) / FEE_DENOMINATOR;
        uint256 amountInAfterFee = msg.value - fee;
        
        // Calculate output based on price
        uint256 amountOut = (amountInAfterFee * 1e18) / tokenPriceInWei[toToken];
        
        require(amountOut >= minAmountOut, "Slippage too high");
        require(amountOut <= tokenLiquidity[toToken], "Insufficient liquidity");

        ethLiquidity += amountInAfterFee;
        tokenLiquidity[toToken] -= amountOut;
        
        IERC20(toToken).safeTransfer(msg.sender, amountOut);
        
        emit Swap(msg.sender, address(0), toToken, msg.value, amountOut, fee);
    }

    /**
     * @dev Swap tokens for ETH
     */
    function swapTokenForETH(address fromToken, uint256 amountIn, uint256 minAmountOut) external nonReentrant {
        require(supportedTokens[fromToken], "Token not supported");
        require(amountIn > 0, "Amount must be > 0");
        require(ethLiquidity > 0, "Insufficient ETH liquidity");

        IERC20(fromToken).safeTransferFrom(msg.sender, address(this), amountIn);

        uint256 fee = (amountIn * swapFee) / FEE_DENOMINATOR;
        uint256 amountInAfterFee = amountIn - fee;
        
        // Calculate ETH output based on price
        uint256 ethOut = (amountInAfterFee * tokenPriceInWei[fromToken]) / 1e18;
        
        require(ethOut >= minAmountOut, "Slippage too high");
        require(ethOut <= ethLiquidity, "Insufficient ETH liquidity");

        tokenLiquidity[fromToken] += amountInAfterFee;
        ethLiquidity -= ethOut;
        
        (bool success, ) = msg.sender.call{value: ethOut}("");
        require(success, "ETH transfer failed");
        
        emit Swap(msg.sender, fromToken, address(0), amountIn, ethOut, fee);
    }

    /**
     * @dev Swap token for token
     */
    function swapTokenForToken(
        address fromToken,
        address toToken,
        uint256 amountIn,
        uint256 minAmountOut
    ) external nonReentrant {
        require(supportedTokens[fromToken] && supportedTokens[toToken], "Token not supported");
        require(fromToken != toToken, "Same token");
        require(amountIn > 0, "Amount must be > 0");
        require(tokenLiquidity[toToken] > 0, "Insufficient liquidity");

        IERC20(fromToken).safeTransferFrom(msg.sender, address(this), amountIn);

        uint256 fee = (amountIn * swapFee) / FEE_DENOMINATOR;
        uint256 amountInAfterFee = amountIn - fee;
        
        // Calculate output: convert to ETH value, then to target token
        uint256 ethValue = (amountInAfterFee * tokenPriceInWei[fromToken]) / 1e18;
        uint256 amountOut = (ethValue * 1e18) / tokenPriceInWei[toToken];
        
        require(amountOut >= minAmountOut, "Slippage too high");
        require(amountOut <= tokenLiquidity[toToken], "Insufficient liquidity");

        tokenLiquidity[fromToken] += amountInAfterFee;
        tokenLiquidity[toToken] -= amountOut;
        
        IERC20(toToken).safeTransfer(msg.sender, amountOut);
        
        emit Swap(msg.sender, fromToken, toToken, amountIn, amountOut, fee);
    }

    // ============ View Functions ============

    /**
     * @dev Get quote for swap
     */
    function getSwapQuote(
        address fromToken,
        address toToken,
        uint256 amountIn
    ) external view returns (uint256 amountOut, uint256 fee) {
        fee = (amountIn * swapFee) / FEE_DENOMINATOR;
        uint256 amountInAfterFee = amountIn - fee;

        if (fromToken == address(0)) {
            // ETH to Token
            amountOut = (amountInAfterFee * 1e18) / tokenPriceInWei[toToken];
        } else if (toToken == address(0)) {
            // Token to ETH
            amountOut = (amountInAfterFee * tokenPriceInWei[fromToken]) / 1e18;
        } else {
            // Token to Token
            uint256 ethValue = (amountInAfterFee * tokenPriceInWei[fromToken]) / 1e18;
            amountOut = (ethValue * 1e18) / tokenPriceInWei[toToken];
        }
    }

    /**
     * @dev Get all supported tokens
     */
    function getSupportedTokens() external view returns (address[] memory) {
        return tokenList;
    }

    /**
     * @dev Get user's liquidity shares
     */
    function getUserShares(address user, address token) external view returns (uint256) {
        return liquidityShares[user][token];
    }

    /**
     * @dev Withdraw accumulated fees (owner only)
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance - ethLiquidity;
        if (balance > 0) {
            (bool success, ) = owner().call{value: balance}("");
            require(success, "Transfer failed");
        }
    }

    receive() external payable {}
}
