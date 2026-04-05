"use client"

import { useWeb3, TOKENS } from "@/context/Web3Context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshCw, Plus, Wallet, ExternalLink, Copy, Check } from "lucide-react"
import { useState } from "react"

export function Account() {
  const { 
    isConnected, 
    account, 
    chainId,
    ethBalance, 
    tokenBalances, 
    refreshBalances, 
    addTokenToWallet,
    connectWallet,
    getSimulatedBalance
  } = useWeb3()
  
  const [copied, setCopied] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshBalances()
    setTimeout(() => setRefreshing(false), 500)
  }

  const copyAddress = () => {
    if (account) {
      navigator.clipboard.writeText(account)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const getNetworkName = (chainId: number | null) => {
    switch (chainId) {
      case 1:
        return "Ethereum Mainnet"
      case 11155111:
        return "Sepolia Testnet"
      case 31337:
        return "Hardhat Local"
      default:
        return "Unknown Network"
    }
  }

  if (!isConnected) {
    return (
      <Card className="w-full max-w-2xl mx-auto bg-card/80 backdrop-blur-sm border-border/50 shadow-2xl" id="account">
        <CardContent className="py-12 text-center">
          <Wallet className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">Connect Your Wallet</h3>
          <p className="text-muted-foreground mb-6">
            Connect your MetaMask wallet to view your token balances
          </p>
          <Button
            onClick={connectWallet}
            className="bg-gradient-to-r from-lime-400 to-emerald-500 text-black font-semibold hover:from-lime-500 hover:to-emerald-600"
          >
            <Wallet className="w-4 h-4 mr-2" />
            Connect Wallet
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-2xl mx-auto bg-card/80 backdrop-blur-sm border-border/50 shadow-2xl" id="account">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Wallet className="w-5 h-5 text-lime-400" />
              Your Account
            </CardTitle>
            <CardDescription>View your token balances and portfolio</CardDescription>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            className="h-9 w-9"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Wallet Info */}
        <div className="bg-gradient-to-r from-lime-400/10 to-emerald-400/10 border border-lime-400/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Connected Wallet</span>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${chainId === 31337 ? "bg-lime-400" : "bg-yellow-400"}`} />
              <span className="text-sm font-medium">{getNetworkName(chainId)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-black/20 px-3 py-2 rounded-lg font-mono overflow-hidden text-ellipsis">
              {account}
            </code>
            <Button variant="ghost" size="icon" onClick={copyAddress} className="h-9 w-9 shrink-0">
              {copied ? <Check className="w-4 h-4 text-lime-400" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="h-9 w-9 shrink-0"
            >
              <a
                href={`https://etherscan.io/address/${account}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          </div>
        </div>

        {/* Token Balances */}
        <div className="space-y-3">
          <h3 className="font-semibold">Token Balances</h3>
          <div className="grid gap-3">
            {Object.entries(TOKENS).map(([key, token]) => {
              // Get balance - ETH from tokenBalances, others from simulated
              const balanceValue = key === "ETH" 
                ? ethBalance 
                : getSimulatedBalance(key).toFixed(4)
              const usdValue = key === "ETH" || key === "WETH"
                ? (parseFloat(balanceValue) * 2000).toFixed(2)
                : key === "USDC" || key === "DAI"
                ? parseFloat(balanceValue).toFixed(2)
                : (parseFloat(balanceValue) * 0.2).toFixed(2)

              return (
                <div
                  key={key}
                  className="flex items-center justify-between p-4 bg-secondary/50 rounded-xl hover:bg-secondary/70 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-xl">
                      {token.logo}
                    </div>
                    <div>
                      <div className="font-semibold">{token.symbol}</div>
                      <div className="text-sm text-muted-foreground">{token.name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{parseFloat(balanceValue).toFixed(4)}</div>
                    <div className="text-sm text-muted-foreground">≈ ${usdValue}</div>
                  </div>
                  {key !== "ETH" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => addTokenToWallet(token)}
                      className="ml-2 text-lime-400 hover:text-lime-300"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Total Value */}
        <div className="bg-gradient-to-r from-lime-400/5 to-emerald-400/5 border border-lime-400/10 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total Portfolio Value</span>
            <span className="text-2xl font-bold">
              ${(
                parseFloat(ethBalance) * 2000 +
                getSimulatedBalance("USDC") +
                getSimulatedBalance("DAI") +
                getSimulatedBalance("WETH") * 2000 +
                getSimulatedBalance("RYAN") * 0.2
              ).toFixed(2)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
