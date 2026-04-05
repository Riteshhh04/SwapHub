"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { BrowserProvider, JsonRpcSigner, formatEther, parseEther } from "ethers"

// Token configuration
export const TOKENS = {
  ETH: {
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logo: "⟠",
  },
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logo: "💵",
  },
  DAI: {
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
    logo: "◈",
  },
  WETH: {
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
    logo: "Ξ",
  },
  RYAN: {
    symbol: "RYAN",
    name: "Ryan Token",
    decimals: 18,
    logo: "🔷",
  },
}

// Exchange rates (simplified for demo)
export const EXCHANGE_RATES: Record<string, Record<string, number>> = {
  ETH: { USDC: 2000, DAI: 2000, WETH: 1, RYAN: 10000 },
  USDC: { ETH: 0.0005, DAI: 1, WETH: 0.0005, RYAN: 5 },
  DAI: { ETH: 0.0005, USDC: 1, WETH: 0.0005, RYAN: 5 },
  WETH: { ETH: 1, USDC: 2000, DAI: 2000, RYAN: 10000 },
  RYAN: { ETH: 0.0001, USDC: 0.2, DAI: 0.2, WETH: 0.0001 },
}

interface TokenBalance {
  symbol: string
  balance: string
}

interface SimulatedBalances {
  [account: string]: {
    [token: string]: number
  }
}

interface Web3ContextType {
  account: string | null
  chainId: number | null
  isConnected: boolean
  isConnecting: boolean
  ethBalance: string
  tokenBalances: TokenBalance[]
  provider: BrowserProvider | null
  signer: JsonRpcSigner | null
  connectWallet: () => Promise<void>
  disconnectWallet: () => void
  switchToHardhat: () => Promise<void>
  refreshBalances: () => Promise<void>
  addTokenToWallet: (token: typeof TOKENS.ETH) => Promise<void>
  // Simulated token functions
  mintTokens: (token: string, amount: number) => void
  getSimulatedBalance: (token: string) => number
  updateSimulatedBalance: (token: string, newBalance: number) => void
  tokensDeployed: boolean
  setTokensDeployed: (deployed: boolean) => void
}

const Web3Context = createContext<Web3ContextType | null>(null)

export function Web3Provider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [ethBalance, setEthBalance] = useState("0")
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([])
  const [provider, setProvider] = useState<BrowserProvider | null>(null)
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null)
  const [simulatedBalances, setSimulatedBalances] = useState<SimulatedBalances>({})
  const [tokensDeployed, setTokensDeployed] = useState(false)

  // Load simulated balances from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("simulatedBalances")
    if (saved) {
      setSimulatedBalances(JSON.parse(saved))
    }
    const deployed = localStorage.getItem("tokensDeployed")
    if (deployed === "true") {
      setTokensDeployed(true)
    }
  }, [])

  // Save simulated balances to localStorage
  useEffect(() => {
    if (Object.keys(simulatedBalances).length > 0) {
      localStorage.setItem("simulatedBalances", JSON.stringify(simulatedBalances))
    }
  }, [simulatedBalances])

  // Save tokensDeployed to localStorage
  useEffect(() => {
    localStorage.setItem("tokensDeployed", tokensDeployed.toString())
  }, [tokensDeployed])

  const getSimulatedBalance = useCallback((token: string): number => {
    if (!account) return 0
    return simulatedBalances[account]?.[token] || 0
  }, [account, simulatedBalances])

  const updateSimulatedBalance = useCallback((token: string, newBalance: number) => {
    if (!account) return
    setSimulatedBalances(prev => ({
      ...prev,
      [account]: {
        ...(prev[account] || {}),
        [token]: Math.max(0, newBalance)
      }
    }))
  }, [account])

  const mintTokens = useCallback((token: string, amount: number) => {
    if (!account) return
    const currentBalance = getSimulatedBalance(token)
    updateSimulatedBalance(token, currentBalance + amount)
  }, [account, getSimulatedBalance, updateSimulatedBalance])

  const refreshBalances = useCallback(async () => {
    if (!provider || !account) return

    try {
      // Get real ETH balance from blockchain
      const balance = await provider.getBalance(account)
      setEthBalance(formatEther(balance))

      // Build token balances array (ETH from blockchain, others from simulated state)
      const balances: TokenBalance[] = []
      
      for (const [key, token] of Object.entries(TOKENS)) {
        if (key === "ETH") {
          balances.push({
            symbol: token.symbol,
            balance: formatEther(balance),
          })
        } else {
          const simBalance = getSimulatedBalance(key)
          balances.push({
            symbol: token.symbol,
            balance: simBalance.toFixed(4),
          })
        }
      }
      
      setTokenBalances(balances)
    } catch (error) {
      console.error("Error refreshing balances:", error)
    }
  }, [provider, account, getSimulatedBalance])

  const connectWallet = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      alert("Please install MetaMask to use this dApp!")
      return
    }

    setIsConnecting(true)
    try {
      const browserProvider = new BrowserProvider(window.ethereum)
      const accounts = await browserProvider.send("eth_requestAccounts", [])
      const network = await browserProvider.getNetwork()
      const walletSigner = await browserProvider.getSigner()

      setProvider(browserProvider)
      setSigner(walletSigner)
      setAccount(accounts[0])
      setChainId(Number(network.chainId))

      localStorage.setItem("walletConnected", "true")
    } catch (error) {
      console.error("Error connecting wallet:", error)
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectWallet = () => {
    setAccount(null)
    setChainId(null)
    setProvider(null)
    setSigner(null)
    setEthBalance("0")
    setTokenBalances([])
    localStorage.removeItem("walletConnected")
  }

  const switchToHardhat = async () => {
    if (!window.ethereum) return

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x7A69" }],
      })
    } catch (error: unknown) {
      if ((error as { code: number }).code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0x7A69",
              chainName: "Hardhat Local",
              nativeCurrency: {
                name: "Ethereum",
                symbol: "ETH",
                decimals: 18,
              },
              rpcUrls: ["http://127.0.0.1:8545"],
            },
          ],
        })
      }
    }
  }

  const addTokenToWallet = async (token: typeof TOKENS.ETH) => {
    if (!window.ethereum || token.symbol === "ETH") return
    alert(`${token.symbol} is a simulated token. Your balance: ${getSimulatedBalance(token.symbol)} ${token.symbol}`)
  }

  // Auto-connect on mount
  useEffect(() => {
    if (localStorage.getItem("walletConnected") === "true") {
      connectWallet()
    }
  }, [])

  // Listen for account/chain changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[]
      if (accounts.length === 0) {
        disconnectWallet()
      } else {
        setAccount(accounts[0])
      }
    }

    const handleChainChanged = (...args: unknown[]) => {
      const chainIdHex = args[0] as string
      setChainId(parseInt(chainIdHex, 16))
    }

    window.ethereum.on("accountsChanged", handleAccountsChanged)
    window.ethereum.on("chainChanged", handleChainChanged)

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged)
      window.ethereum?.removeListener("chainChanged", handleChainChanged)
    }
  }, [])

  // Refresh balances when account or simulated balances change
  useEffect(() => {
    if (account && provider) {
      refreshBalances()
    }
  }, [account, provider, refreshBalances, simulatedBalances])

  return (
    <Web3Context.Provider
      value={{
        account,
        chainId,
        isConnected: !!account,
        isConnecting,
        ethBalance,
        tokenBalances,
        provider,
        signer,
        connectWallet,
        disconnectWallet,
        switchToHardhat,
        refreshBalances,
        addTokenToWallet,
        mintTokens,
        getSimulatedBalance,
        updateSimulatedBalance,
        tokensDeployed,
        setTokensDeployed,
      }}
    >
      {children}
    </Web3Context.Provider>
  )
}

export function useWeb3() {
  const context = useContext(Web3Context)
  if (!context) {
    throw new Error("useWeb3 must be used within a Web3Provider")
  }
  return context
}

// Export utilities
export { formatEther, parseEther }
