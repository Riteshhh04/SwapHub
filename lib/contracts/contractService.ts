import { Contract, BrowserProvider, JsonRpcSigner, parseUnits, formatUnits } from "ethers";
import { SwapHubTokenABI } from "./SwapHubTokenABI";
import { SwapHubDEXABI } from "./SwapHubDEXABI";
import { 
  loadDeployedAddresses, 
  saveDeployedAddresses, 
  TOKEN_CONFIGS,
  type DeployedContracts 
} from "./config";

// Contract bytecodes - These would normally be imported from compiled artifacts
// For deployment, you would compile the contracts with Hardhat/Foundry
// Here we provide the interface for when bytecodes are available

export interface TokenDeployParams {
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: string;
  maxSupply: string;
  faucetAmount: string;
}

export class ContractService {
  private provider: BrowserProvider | null = null;
  private signer: JsonRpcSigner | null = null;
  private deployedContracts: DeployedContracts | null = null;

  constructor() {
    this.deployedContracts = loadDeployedAddresses();
  }

  // Initialize with provider and signer
  async initialize(provider: BrowserProvider, signer: JsonRpcSigner) {
    this.provider = provider;
    this.signer = signer;
    this.deployedContracts = loadDeployedAddresses();
  }

  // Get deployed contracts
  getDeployedContracts(): DeployedContracts | null {
    return this.deployedContracts;
  }

  // Check if DEX is deployed
  isDEXDeployed(): boolean {
    return !!this.deployedContracts?.dex;
  }

  // Check if a token is deployed
  isTokenDeployed(symbol: string): boolean {
    return !!this.deployedContracts?.tokens[symbol];
  }

  // ============ Token Contract Methods ============

  // Get token contract instance
  getTokenContract(address: string): Contract | null {
    if (!this.signer || !address) return null;
    return new Contract(address, SwapHubTokenABI, this.signer);
  }

  // Get token balance
  async getTokenBalance(tokenAddress: string, userAddress: string): Promise<string> {
    const contract = this.getTokenContract(tokenAddress);
    if (!contract) return "0";

    try {
      const balance = await contract.balanceOf(userAddress);
      const decimals = await contract.decimals();
      return formatUnits(balance, decimals);
    } catch (error) {
      console.error("Error getting token balance:", error);
      return "0";
    }
  }

  // Get token info
  async getTokenInfo(tokenAddress: string): Promise<{
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
  } | null> {
    const contract = this.getTokenContract(tokenAddress);
    if (!contract) return null;

    try {
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.decimals(),
        contract.totalSupply(),
      ]);

      return {
        name,
        symbol,
        decimals: Number(decimals),
        totalSupply: formatUnits(totalSupply, decimals),
      };
    } catch (error) {
      console.error("Error getting token info:", error);
      return null;
    }
  }

  // Claim from faucet
  async claimFaucet(tokenAddress: string): Promise<{ hash: string; success: boolean }> {
    const contract = this.getTokenContract(tokenAddress);
    if (!contract) throw new Error("Contract not initialized");

    try {
      const tx = await contract.faucet();
      await tx.wait();
      return { hash: tx.hash, success: true };
    } catch (error) {
      console.error("Error claiming faucet:", error);
      throw error;
    }
  }

  // Check if can claim faucet
  async canClaimFaucet(tokenAddress: string, userAddress: string): Promise<boolean> {
    const contract = this.getTokenContract(tokenAddress);
    if (!contract) return false;

    try {
      return await contract.canClaimFaucet(userAddress);
    } catch (error) {
      console.error("Error checking faucet:", error);
      return false;
    }
  }

  // Approve token spending
  async approveToken(
    tokenAddress: string,
    spenderAddress: string,
    amount: string,
    decimals: number
  ): Promise<{ hash: string; success: boolean }> {
    const contract = this.getTokenContract(tokenAddress);
    if (!contract) throw new Error("Contract not initialized");

    try {
      const amountWei = parseUnits(amount, decimals);
      const tx = await contract.approve(spenderAddress, amountWei);
      await tx.wait();
      return { hash: tx.hash, success: true };
    } catch (error) {
      console.error("Error approving token:", error);
      throw error;
    }
  }

  // Get allowance
  async getAllowance(
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string,
    decimals: number
  ): Promise<string> {
    const contract = this.getTokenContract(tokenAddress);
    if (!contract) return "0";

    try {
      const allowance = await contract.allowance(ownerAddress, spenderAddress);
      return formatUnits(allowance, decimals);
    } catch (error) {
      console.error("Error getting allowance:", error);
      return "0";
    }
  }

  // ============ DEX Contract Methods ============

  // Get DEX contract instance
  getDEXContract(): Contract | null {
    if (!this.signer || !this.deployedContracts?.dex) return null;
    return new Contract(this.deployedContracts.dex, SwapHubDEXABI, this.signer);
  }

  // Get swap quote
  async getSwapQuote(
    fromToken: string,
    toToken: string,
    amountIn: string,
    decimals: number
  ): Promise<{ amountOut: string; fee: string } | null> {
    const dex = this.getDEXContract();
    if (!dex) return null;

    try {
      const amountInWei = parseUnits(amountIn, decimals);
      const [amountOut, fee] = await dex.getSwapQuote(fromToken, toToken, amountInWei);
      return {
        amountOut: formatUnits(amountOut, 18), // Assuming 18 decimals for output
        fee: formatUnits(fee, decimals),
      };
    } catch (error) {
      console.error("Error getting swap quote:", error);
      return null;
    }
  }

  // Swap ETH for Token
  async swapETHForToken(
    toTokenAddress: string,
    amountInETH: string,
    minAmountOut: string,
    toDecimals: number
  ): Promise<{ hash: string; success: boolean }> {
    const dex = this.getDEXContract();
    if (!dex) throw new Error("DEX not initialized");

    try {
      const minOut = parseUnits(minAmountOut, toDecimals);
      const tx = await dex.swapETHForToken(toTokenAddress, minOut, {
        value: parseUnits(amountInETH, 18),
      });
      await tx.wait();
      return { hash: tx.hash, success: true };
    } catch (error) {
      console.error("Error swapping ETH for token:", error);
      throw error;
    }
  }

  // Swap Token for ETH
  async swapTokenForETH(
    fromTokenAddress: string,
    amountIn: string,
    minAmountOut: string,
    fromDecimals: number
  ): Promise<{ hash: string; success: boolean }> {
    const dex = this.getDEXContract();
    if (!dex) throw new Error("DEX not initialized");

    try {
      const amountInWei = parseUnits(amountIn, fromDecimals);
      const minOut = parseUnits(minAmountOut, 18);
      const tx = await dex.swapTokenForETH(fromTokenAddress, amountInWei, minOut);
      await tx.wait();
      return { hash: tx.hash, success: true };
    } catch (error) {
      console.error("Error swapping token for ETH:", error);
      throw error;
    }
  }

  // Swap Token for Token
  async swapTokenForToken(
    fromTokenAddress: string,
    toTokenAddress: string,
    amountIn: string,
    minAmountOut: string,
    fromDecimals: number,
    toDecimals: number
  ): Promise<{ hash: string; success: boolean }> {
    const dex = this.getDEXContract();
    if (!dex) throw new Error("DEX not initialized");

    try {
      const amountInWei = parseUnits(amountIn, fromDecimals);
      const minOut = parseUnits(minAmountOut, toDecimals);
      const tx = await dex.swapTokenForToken(
        fromTokenAddress,
        toTokenAddress,
        amountInWei,
        minOut
      );
      await tx.wait();
      return { hash: tx.hash, success: true };
    } catch (error) {
      console.error("Error swapping tokens:", error);
      throw error;
    }
  }

  // Add ETH liquidity
  async addETHLiquidity(amountETH: string): Promise<{ hash: string; success: boolean }> {
    const dex = this.getDEXContract();
    if (!dex) throw new Error("DEX not initialized");

    try {
      const tx = await dex.addEthLiquidity({
        value: parseUnits(amountETH, 18),
      });
      await tx.wait();
      return { hash: tx.hash, success: true };
    } catch (error) {
      console.error("Error adding ETH liquidity:", error);
      throw error;
    }
  }

  // Add token liquidity
  async addTokenLiquidity(
    tokenAddress: string,
    amount: string,
    decimals: number
  ): Promise<{ hash: string; success: boolean }> {
    const dex = this.getDEXContract();
    if (!dex) throw new Error("DEX not initialized");

    try {
      const amountWei = parseUnits(amount, decimals);
      const tx = await dex.addTokenLiquidity(tokenAddress, amountWei);
      await tx.wait();
      return { hash: tx.hash, success: true };
    } catch (error) {
      console.error("Error adding token liquidity:", error);
      throw error;
    }
  }

  // Get pool liquidity
  async getPoolLiquidity(tokenAddress: string): Promise<string> {
    const dex = this.getDEXContract();
    if (!dex) return "0";

    try {
      const liquidity = await dex.tokenLiquidity(tokenAddress);
      return formatUnits(liquidity, 18);
    } catch (error) {
      console.error("Error getting pool liquidity:", error);
      return "0";
    }
  }

  // Get ETH liquidity
  async getETHLiquidity(): Promise<string> {
    const dex = this.getDEXContract();
    if (!dex) return "0";

    try {
      const liquidity = await dex.ethLiquidity();
      return formatUnits(liquidity, 18);
    } catch (error) {
      console.error("Error getting ETH liquidity:", error);
      return "0";
    }
  }

  // Save deployed contract addresses
  saveContracts(contracts: DeployedContracts) {
    this.deployedContracts = contracts;
    saveDeployedAddresses(contracts);
  }

  // Clear deployed contracts (for testing)
  clearContracts() {
    this.deployedContracts = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("swaphub_dex_address");
      localStorage.removeItem("swaphub_token_addresses");
    }
  }
}

// Singleton instance
export const contractService = new ContractService();

// Export token configs for use in components
export { TOKEN_CONFIGS };
