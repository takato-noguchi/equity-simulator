"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calculator, TrendingUp, DollarSign, Calendar, Clock, BarChart3 } from "lucide-react"

interface SimulationResult {
  totalValue: number
  yearlyBreakdown: {
    year: number
    salary: number
    stockValue: number
    vestedShares: number
    cumulativeVestedShares: number
    totalAnnual: number
    isCliffPeriod: boolean
  }[]
  finalStockValue: number
  totalStockGain: number
  grantedShares: number
  expectedReturn: number
  currentMarketCap: number
  futureMarketCap: number
  vestingSchedule: string
  cliffPeriod: number
}

export default function EquitySimulator() {
  const [baseSalary, setBaseSalary] = useState("6000000")
  const [stockCompensation, setStockCompensation] = useState("1000000")
  const [jobType, setJobType] = useState("")
  const [experience, setExperience] = useState("")
  const [stockSystem, setStockSystem] = useState("")
  const [currentStockPrice, setCurrentStockPrice] = useState([5000])
  const [growthRate, setGrowthRate] = useState([20])
  const [vestingPeriod, setVestingPeriod] = useState([4])
  const [cliffPeriod, setCliffPeriod] = useState([12]) // 月単位
  const [vestingSchedule, setVestingSchedule] = useState("linear")
  const [vestingFrequency, setVestingFrequency] = useState("monthly")
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const calculateVestedShares = (
    totalShares: number,
    monthsElapsed: number,
    totalVestingMonths: number,
    cliffMonths: number,
    schedule: string,
  ) => {
    // クリフ期間中は0
    if (monthsElapsed < cliffMonths) {
      return 0
    }

    const monthsAfterCliff = monthsElapsed - cliffMonths
    const vestingMonthsAfterCliff = totalVestingMonths - cliffMonths

    switch (schedule) {
      case "linear":
        // リニアベスティング：均等に権利確定
        return Math.min(totalShares, (totalShares * monthsAfterCliff) / vestingMonthsAfterCliff)

      case "backloaded":
        // バックローデッド：後半により多く権利確定
        const progress = monthsAfterCliff / vestingMonthsAfterCliff
        return Math.min(totalShares, totalShares * Math.pow(progress, 1.5))

      case "frontloaded":
        // フロントローデッド：前半により多く権利確定
        const frontProgress = monthsAfterCliff / vestingMonthsAfterCliff
        return Math.min(totalShares, totalShares * Math.pow(frontProgress, 0.7))

      case "cliff-heavy":
        // クリフ後に大きな割合、その後リニア
        if (monthsElapsed === cliffMonths) {
          return totalShares * 0.25 // クリフ後に25%
        }
        const remaining = totalShares * 0.75
        return totalShares * 0.25 + Math.min(remaining, (remaining * monthsAfterCliff) / vestingMonthsAfterCliff)

      default:
        return Math.min(totalShares, (totalShares * monthsAfterCliff) / vestingMonthsAfterCliff)
    }
  }

  const executeSimulation = async () => {
    setIsSimulating(true)

    // シミュレーション実行のアニメーション
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const salary = Number.parseInt(baseSalary)
    const stockComp = Number.parseInt(stockCompensation)
    const initialPrice = currentStockPrice[0]
    const annualGrowth = growthRate[0] / 100
    const years = vestingPeriod[0]
    const cliffMonths = cliffPeriod[0]

    // 株式数を計算（初期株式報酬額 ÷ 現在の株価）
    const totalShares = stockComp / initialPrice
    const totalVestingMonths = years * 12

    const yearlyBreakdown = []
    let totalValue = 0

    for (let year = 1; year <= years; year++) {
      const monthsElapsed = year * 12
      const stockPriceAtYear = initialPrice * Math.pow(1 + annualGrowth, year)

      const vestedShares = calculateVestedShares(
        totalShares,
        monthsElapsed,
        totalVestingMonths,
        cliffMonths,
        vestingSchedule,
      )

      const previousYearVestedShares =
        year > 1
          ? calculateVestedShares(totalShares, (year - 1) * 12, totalVestingMonths, cliffMonths, vestingSchedule)
          : 0

      const newlyVestedShares = vestedShares - previousYearVestedShares
      const stockValue = newlyVestedShares * stockPriceAtYear
      const isCliffPeriod = monthsElapsed <= cliffMonths

      yearlyBreakdown.push({
        year,
        salary,
        stockValue,
        vestedShares: newlyVestedShares,
        cumulativeVestedShares: vestedShares,
        totalAnnual: salary + stockValue,
        isCliffPeriod,
      })

      totalValue += salary + stockValue
    }

    const finalStockPrice = initialPrice * Math.pow(1 + annualGrowth, years)
    const finalVestedShares = calculateVestedShares(
      totalShares,
      totalVestingMonths,
      totalVestingMonths,
      cliffMonths,
      vestingSchedule,
    )
    const finalStockValue = finalVestedShares * finalStockPrice
    const totalStockGain = finalStockValue - (finalVestedShares / totalShares) * stockComp

    // 新しい計算を追加
    const grantedShares = totalShares
    const expectedReturn =
      finalVestedShares > 0
        ? ((finalStockValue - (finalVestedShares / totalShares) * stockComp) /
            ((finalVestedShares / totalShares) * stockComp)) *
          100
        : 0

    // 仮定：発行済み株式数（実際の企業では実際の値を使用）
    const totalOutstandingShares = 10000000 // 1000万株と仮定
    const currentMarketCap = initialPrice * totalOutstandingShares
    const futureMarketCap = finalStockPrice * totalOutstandingShares

    setSimulationResult({
      totalValue,
      yearlyBreakdown,
      finalStockValue,
      totalStockGain,
      grantedShares,
      expectedReturn,
      currentMarketCap,
      futureMarketCap,
      vestingSchedule,
      cliffPeriod: cliffMonths,
    })

    setIsSimulating(false)
  }

  const getVestingScheduleDescription = (schedule: string) => {
    switch (schedule) {
      case "linear":
        return "均等に権利確定"
      case "backloaded":
        return "後半により多く権利確定"
      case "frontloaded":
        return "前半により多く権利確定"
      case "cliff-heavy":
        return "クリフ後25%、その後均等"
      default:
        return "均等に権利確定"
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">エクイティシミュレーター</h1>
          <p className="text-gray-600">株式報酬の将来価値をシミュレーション</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 左側：条件設定 */}
          <Card className="bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-blue-600" />
                条件設定
              </CardTitle>
              <p className="text-sm text-gray-600">あなたの情報を入力してください</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="baseSalary">基本年収 (円)</Label>
                  <Input
                    id="baseSalary"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    placeholder="6000000"
                  />
                </div>
                <div>
                  <Label htmlFor="stockCompensation">株式報酬予定額 (円)</Label>
                  <Input
                    id="stockCompensation"
                    value={stockCompensation}
                    onChange={(e) => setStockCompensation(e.target.value)}
                    placeholder="1000000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>職種</Label>
                  <Select value={jobType} onValueChange={setJobType}>
                    <SelectTrigger>
                      <SelectValue placeholder="職種を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="engineer">エンジニア</SelectItem>
                      <SelectItem value="designer">デザイナー</SelectItem>
                      <SelectItem value="pm">プロダクトマネージャー</SelectItem>
                      <SelectItem value="sales">営業</SelectItem>
                      <SelectItem value="marketing">マーケティング</SelectItem>
                      <SelectItem value="other">その他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>経験年数</Label>
                  <Select value={experience} onValueChange={setExperience}>
                    <SelectTrigger>
                      <SelectValue placeholder="経験年数を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-2">1-2年</SelectItem>
                      <SelectItem value="3-5">3-5年</SelectItem>
                      <SelectItem value="6-10">6-10年</SelectItem>
                      <SelectItem value="10+">10年以上</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>株式報酬制度</Label>
                <Select value={stockSystem} onValueChange={setStockSystem}>
                  <SelectTrigger>
                    <SelectValue placeholder="制度を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stock-options">ストックオプション</SelectItem>
                    <SelectItem value="restricted-stock">制限付株式</SelectItem>
                    <SelectItem value="rsu">RSU (制限付株式ユニット)</SelectItem>
                    <SelectItem value="espp">従業員株式購入プラン</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">制限付株式ユニット - 権利確定時に選択可能</p>
              </div>

              {/* ベスティング設定 */}
              <div className="space-y-4 p-4 bg-white rounded-lg border">
                <h3 className="font-semibold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  ベスティング設定
                </h3>

                <div>
                  <Label>ベスティングスケジュール</Label>
                  <Select value={vestingSchedule} onValueChange={setVestingSchedule}>
                    <SelectTrigger>
                      <SelectValue placeholder="スケジュールを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="linear">リニア（均等）</SelectItem>
                      <SelectItem value="backloaded">バックローデッド</SelectItem>
                      <SelectItem value="frontloaded">フロントローデッド</SelectItem>
                      <SelectItem value="cliff-heavy">クリフ重視</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">{getVestingScheduleDescription(vestingSchedule)}</p>
                </div>

                <div>
                  <Label>クリフ期間: {cliffPeriod[0]}ヶ月</Label>
                  <Slider
                    value={cliffPeriod}
                    onValueChange={setCliffPeriod}
                    max={24}
                    min={0}
                    step={3}
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">この期間中は株式の権利確定なし</p>
                </div>

                <div>
                  <Label>ベスティング頻度</Label>
                  <Select value={vestingFrequency} onValueChange={setVestingFrequency}>
                    <SelectTrigger>
                      <SelectValue placeholder="頻度を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">月次</SelectItem>
                      <SelectItem value="quarterly">四半期</SelectItem>
                      <SelectItem value="annually">年次</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>現在の株価: {formatCurrency(currentStockPrice[0])}</Label>
                  <Slider
                    value={currentStockPrice}
                    onValueChange={setCurrentStockPrice}
                    max={20000}
                    min={1000}
                    step={500}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label>期待年間成長率: {growthRate[0]}%</Label>
                  <Slider value={growthRate} onValueChange={setGrowthRate} max={50} min={0} step={5} className="mt-2" />
                </div>

                <div>
                  <Label>権利確定期間: {vestingPeriod[0]}年</Label>
                  <Slider
                    value={vestingPeriod}
                    onValueChange={setVestingPeriod}
                    max={6}
                    min={1}
                    step={1}
                    className="mt-2"
                  />
                </div>
              </div>

              <Button
                onClick={executeSimulation}
                className="w-full bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700"
                size="lg"
                disabled={isSimulating}
              >
                <Calculator className="w-4 h-4 mr-2" />
                {isSimulating ? "シミュレーション実行中..." : "シミュレーション実行"}
              </Button>
            </CardContent>
          </Card>

          {/* 右側：シミュレーション結果 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                {simulationResult ? "シミュレーション結果" : "シミュレーション待機中"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!simulationResult && !isSimulating && (
                <div className="flex flex-col items-center justify-center h-96 text-gray-500">
                  <Calculator className="w-16 h-16 mb-4 text-gray-300" />
                  <p className="text-center">
                    左側で条件を設定してシミュレーション実行を
                    <br />
                    クリックしてください
                  </p>
                </div>
              )}

              {isSimulating && (
                <div className="flex flex-col items-center justify-center h-96">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-600">計算中...</p>
                </div>
              )}

              {simulationResult && (
                <div className="space-y-6">
                  {/* ベスティング情報 */}
                  <Card className="bg-yellow-50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-yellow-600" />
                        <span className="text-sm font-medium text-yellow-800">ベスティング条件</span>
                      </div>
                      <div className="text-sm text-yellow-900">
                        <p>スケジュール: {getVestingScheduleDescription(simulationResult.vestingSchedule)}</p>
                        <p>クリフ期間: {simulationResult.cliffPeriod}ヶ月</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* サマリーカード */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="bg-green-50">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium text-green-800">総収入</span>
                        </div>
                        <p className="text-2xl font-bold text-green-900">
                          {formatCurrency(simulationResult.totalValue)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-blue-50">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">株式利益</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-900">
                          {formatCurrency(simulationResult.totalStockGain)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* 詳細情報カード */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="bg-orange-50">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-4 h-4 text-orange-600" />
                          <span className="text-sm font-medium text-orange-800">付与株式数</span>
                        </div>
                        <p className="text-2xl font-bold text-orange-900">
                          {Math.round(simulationResult.grantedShares).toLocaleString()}株
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-purple-50">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Calculator className="w-4 h-4 text-purple-600" />
                          <span className="text-sm font-medium text-purple-800">想定リターン</span>
                        </div>
                        <p className="text-2xl font-bold text-purple-900">
                          {simulationResult.expectedReturn.toFixed(1)}%
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* 時価総額情報 */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="bg-gray-50">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="w-4 h-4 text-gray-600" />
                          <span className="text-sm font-medium text-gray-800">現在時価総額</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatCurrency(simulationResult.currentMarketCap)}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">現在の株価基準</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-indigo-50">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-4 h-4 text-indigo-600" />
                          <span className="text-sm font-medium text-indigo-800">将来時価総額</span>
                        </div>
                        <p className="text-2xl font-bold text-indigo-900">
                          {formatCurrency(simulationResult.futureMarketCap)}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">{vestingPeriod[0]}年後予想</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* 年次詳細 */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      年次詳細
                    </h3>
                    <div className="space-y-3">
                      {simulationResult.yearlyBreakdown.map((year) => (
                        <Card
                          key={year.year}
                          className={`border-l-4 ${
                            year.isCliffPeriod ? "border-l-red-500 bg-red-50" : "border-l-blue-500"
                          }`}
                        >
                          <CardContent className="p-4">
                            <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{year.year}年目</span>
                                {year.isCliffPeriod && (
                                  <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">クリフ期間</span>
                                )}
                              </div>
                              <span className="text-lg font-bold">{formatCurrency(year.totalAnnual)}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                              <div>
                                <span>基本給: {formatCurrency(year.salary)}</span>
                              </div>
                              <div>
                                <span>株式価値: {formatCurrency(year.stockValue)}</span>
                              </div>
                              <div>
                                <span>新規権利確定: {Math.round(year.vestedShares).toLocaleString()}株</span>
                              </div>
                              <div>
                                <span>累積権利確定: {Math.round(year.cumulativeVestedShares).toLocaleString()}株</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* 最終株式価値 */}
                  <Card className="bg-gradient-to-r from-purple-50 to-pink-50">
                    <CardContent className="p-4">
                      <h4 className="font-semibold mb-2">最終株式価値</h4>
                      <p className="text-2xl font-bold text-purple-900">
                        {formatCurrency(simulationResult.finalStockValue)}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">{vestingPeriod[0]}年後の予想株式価値</p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
