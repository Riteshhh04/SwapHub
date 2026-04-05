"use client"

import { useState, useEffect } from "react"
import { useWeb3, TOKENS } from "@/context/Web3Context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Droplets, TrendingUp, DollarSign, Percent, Activity } from "lucide-react"

interface PoolData {
  pair: string
  token0: string
  token1: string
  tvl: number
  volume24h: number
  volume7d: number
  apy: number
  fees24h: number
  priceChange24h: number
}

export function PoolStats() {
  const { tokenPrices, isConnected } = useWeb3()
  const [pools, setPools] = useState<PoolData[]>([])
  const [totalTVL, setTotalTVL] = useState(0)
  const [totalVolume, setTotalVolume] = useState(0)

  // Generate realistic pool data based on real token prices
  useEffect(() => {
    const generatePoolData = () => {
      const poolPairs: [string, string][] = [
        ["ETH", "USDC"],
        ["ETH", "DAI"],
        ["WETH", "USDC"],
        ["LINK", "ETH"],
        ["UNI", "ETH"],
        ["AAVE", "ETH"],
        ["MATIC", "USDC"],
        ["UNI", "USDC"],
        ["LINK", "USDC"],
        ["AAVE", "USDC"],
      ]

      const poolData: PoolData[] = poolPairs.map(([token0, token1]) => {
        const price0 = tokenPrices[token0] || 1
        const price1 = tokenPrices[token1] || 1

        // Generate realistic TVL based on token popularity
        const baseTVL = token0 === "ETH" || token1 === "ETH" ? 50000000 : 10000000
        const tvl = baseTVL * (0.5 + Math.random())

        // Volume is typically 5-20% of TVL
        const volume24h = tvl * (0.05 + Math.random() * 0.15)
        const volume7d = volume24h * 7 * (0.8 + Math.random() * 0.4)

        // Fees are 0.3% of volume
        const fees24h = volume24h * 0.003

        // APY calculation based on fees and TVL
        const dailyReturn = fees24h / tvl
        const apy = dailyReturn * 365 * 100

        // Random price change
        const priceChange24h = (Math.random() - 0.5) * 10

        return {
          pair: `${token0}/${token1}`,
          token0,
          token1,
          tvl,
          volume24h,
          volume7d,
          apy,
          fees24h,
          priceChange24h,
        }
      })

      // Sort by TVL
      poolData.sort((a, b) => b.tvl - a.tvl)

      setPools(poolData)
      setTotalTVL(poolData.reduce((sum, p) => sum + p.tvl, 0))
      setTotalVolume(poolData.reduce((sum, p) => sum + p.volume24h, 0))
    }

    generatePoolData()
    
    // Refresh every 30 seconds
    const interval = setInterval(generatePoolData, 30000)
    return () => clearInterval(interval)
  }, [tokenPrices])

  const formatCurrency = (value: number) => {
    if (value >= 1000000000) {
      return `$${(value / 1000000000).toFixed(2)}B`
    } else if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(2)}K`
    }
    return `$${value.toFixed(2)}`
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-lime-400/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-lime-400" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total TVL</div>
                <div className="text-xl font-bold">{formatCurrency(totalTVL)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-400/20 flex items-center justify-center">
                <Activity className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">24h Volume</div>
                <div className="text-xl font-bold">{formatCurrency(totalVolume)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-400/20 flex items-center justify-center">
                <Droplets className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Active Pools</div>
                <div className="text-xl font-bold">{pools.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-400/20 flex items-center justify-center">
                <Percent className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Avg APY</div>
                <div className="text-xl font-bold">
                  {pools.length > 0
                    ? (pools.reduce((sum, p) => sum + p.apy, 0) / pools.length).toFixed(2)
                    : 0}
                  %
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pool Table */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-lime-400" />
            Liquidity Pools
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Pool</TableHead>
                  <TableHead className="text-right">TVL</TableHead>
                  <TableHead className="text-right">24h Volume</TableHead>
                  <TableHead className="text-right">7d Volume</TableHead>
                  <TableHead className="text-right">24h Fees</TableHead>
                  <TableHead className="text-right">APY</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pools.map((pool, index) => (
                  <TableRow key={pool.pair} className="hover:bg-secondary/30">
                    <TableCell className="font-medium text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-sm border-2 border-card">
                            {TOKENS[pool.token0]?.logo}
                          </div>
                          <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-sm border-2 border-card">
                            {TOKENS[pool.token1]?.logo}
                          </div>
                        </div>
                        <span className="font-medium">{pool.pair}</span>
                        <Badge variant="secondary" className="text-xs">
                          0.3%
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(pool.tvl)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(pool.volume24h)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(pool.volume7d)}
                    </TableCell>
                    <TableCell className="text-right text-emerald-400">
                      {formatCurrency(pool.fees24h)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`font-medium ${
                          pool.apy > 20
                            ? "text-emerald-400"
                            : pool.apy > 10
                            ? "text-lime-400"
                            : "text-foreground"
                        }`}
                      >
                        {pool.apy.toFixed(2)}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pool Distribution Chart */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">TVL Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {pools.slice(0, 5).map((pool) => {
              const percentage = (pool.tvl / totalTVL) * 100
              return (
                <div key={pool.pair} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{pool.pair}</span>
                    <span className="text-muted-foreground">
                      {formatCurrency(pool.tvl)} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-lime-400 to-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
