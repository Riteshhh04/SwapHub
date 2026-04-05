// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SwapHubToken
 * @dev ERC-20 Token for SwapHub DEX
 * Features:
 * - Mintable by owner (for faucet functionality)
 * - Burnable by token holders
 * - Standard ERC-20 functionality
 */
contract SwapHubToken is ERC20, ERC20Burnable, Ownable {
    uint8 private _decimals;
    
    // Maximum supply cap (optional, set to 0 for unlimited)
    uint256 public maxSupply;
    
    // Faucet cooldown tracking
    mapping(address => uint256) public lastFaucetClaim;
    uint256 public faucetCooldown = 1 hours;
    uint256 public faucetAmount;

    event FaucetClaim(address indexed user, uint256 amount);
    event FaucetSettingsUpdated(uint256 newAmount, uint256 newCooldown);

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        uint256 initialSupply,
        uint256 _maxSupply,
        uint256 _faucetAmount
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _decimals = decimals_;
        maxSupply = _maxSupply;
        faucetAmount = _faucetAmount;
        
        if (initialSupply > 0) {
            _mint(msg.sender, initialSupply);
        }
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Mint new tokens (only owner)
     */
    function mint(address to, uint256 amount) public onlyOwner {
        require(maxSupply == 0 || totalSupply() + amount <= maxSupply, "Exceeds max supply");
        _mint(to, amount);
    }

    /**
     * @dev Public faucet function - anyone can claim tokens with cooldown
     */
    function faucet() public {
        require(faucetAmount > 0, "Faucet is disabled");
        require(
            block.timestamp >= lastFaucetClaim[msg.sender] + faucetCooldown,
            "Faucet cooldown not expired"
        );
        require(maxSupply == 0 || totalSupply() + faucetAmount <= maxSupply, "Exceeds max supply");

        lastFaucetClaim[msg.sender] = block.timestamp;
        _mint(msg.sender, faucetAmount);
        
        emit FaucetClaim(msg.sender, faucetAmount);
    }

    /**
     * @dev Check if user can claim from faucet
     */
    function canClaimFaucet(address user) public view returns (bool) {
        return block.timestamp >= lastFaucetClaim[user] + faucetCooldown;
    }

    /**
     * @dev Get time until next faucet claim
     */
    function timeUntilNextClaim(address user) public view returns (uint256) {
        if (canClaimFaucet(user)) return 0;
        return (lastFaucetClaim[user] + faucetCooldown) - block.timestamp;
    }

    /**
     * @dev Update faucet settings (only owner)
     */
    function setFaucetSettings(uint256 _faucetAmount, uint256 _faucetCooldown) public onlyOwner {
        faucetAmount = _faucetAmount;
        faucetCooldown = _faucetCooldown;
        emit FaucetSettingsUpdated(_faucetAmount, _faucetCooldown);
    }
}
