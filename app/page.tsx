"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calculator, TrendingUp, DollarSign, Percent, Building2, Clock, BarChart3, Receipt } from "lucide-react"
import {} from "recharts"
import {} from "@/components/ui/chart"

interface SimulationResult {
  currentStockPrice: number
  futureStockPrice: number
  currentReturn: number
  futureReturn: number
  grantedPercentage: number
  totalCurrentValue: number
  totalFutureValue: number
  exerciseCost: number
  netCurrentReturn: number
  netFutureReturn: number
  vestedShares: number
  vestingSchedule: {
    year: number
    vestedShares: number
    cumulativeVestedShares: number
    isCliffPeriod: boolean
  }[]
  taxCalculation: {
    exerciseTax: number
    saleTax: number
    totalTax: number
    netReturnAfterTax: number
    taxRate: number
  }
}

export default function EquitySimulator() {
  const [outstandingShares, setOutstandingShares] = useState("10000000")
  const [currentMarketCap, setCurrentMarketCap] = useState("50000000000")
  const [futureMarketCap, setFutureMarketCap] = useState("100000000000")
  const [grantedShares, setGrantedShares] = useState("50000")
  const [exercisePrice, setExercisePrice] = useState("1000")
  const [grantedPercentage, setGrantedPercentage] = useState("")

  // ベスティング設定
  const [vestingPeriod, setVestingPeriod] = useState([4])
  const [cliffPeriod, setCliffPeriod] = useState([1])
  const [yearsElapsed, setYearsElapsed] = useState([4])

  // 税制設定
  const [isTaxQualified, setIsTaxQualified] = useState("qualified")
  const [holdingPeriod, setHoldingPeriod] = useState([2])

  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("ja-JP").format(num)
  }

  const formatNumberWithDecimals = (num: number, decimals = 2) => {
    return new Intl.NumberFormat("ja-JP", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num)
  }

  // 数値入力時にカンマを自動挿入する関数を追加
  const formatInputNumber = (value: string) => {
    const numericValue = value.replace(/,/g, "")
    if (numericValue && !isNaN(Number(numericValue))) {
      return Number(numericValue).toLocaleString("ja-JP")
    }
    return value
  }

  // 各入力フィールドのonChangeハンドラーを更新
  const handleOutstandingSharesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/,/g, "")
    setOutstandingShares(rawValue)
  }

  const handleCurrentMarketCapChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/,/g, "")
    setCurrentMarketCap(rawValue)
  }

  const handleFutureMarketCapChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/,/g, "")
    setFutureMarketCap(rawValue)
  }

  const handleGrantedSharesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/,/g, "")
    setGrantedShares(rawValue)
  }

  const handleExercisePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/,/g, "")
    setExercisePrice(rawValue)
  }

  // 付与株式数が変更されたときに付与％を自動計算
  useEffect(() => {
    console.log("計算デバッグ:", { outstandingShares, grantedShares })

    if (outstandingShares && grantedShares) {
      const outstanding = Number.parseFloat(outstandingShares.replace(/,/g, ""))
      const granted = Number.parseFloat(grantedShares.replace(/,/g, ""))

      console.log("パース後の値:", { outstanding, granted })

      if (outstanding > 0 && granted >= 0) {
        const percentage = (granted / outstanding) * 100
        console.log("計算結果:", {
          granted,
          outstanding,
          division: granted / outstanding,
          percentage,
        })
        setGrantedPercentage(percentage.toFixed(8)) // より精密に表示
      }
    }
  }, [outstandingShares, grantedShares])

  // 付与％が変更されたときに付与株式数を自動計算
  const handlePercentageChange = (value: string) => {
    setGrantedPercentage(value)
    if (outstandingShares && value) {
      const outstanding = Number.parseFloat(outstandingShares.replace(/,/g, ""))
      const percentage = Number.parseFloat(value)
      if (outstanding > 0 && percentage >= 0) {
        const granted = Math.round((outstanding * percentage) / 100)
        setGrantedShares(granted.toString())
      }
    }
  }

  // ベスティング計算
  const calculateVestedShares = (
    totalShares: number,
    yearsElapsed: number,
    totalVestingYears: number,
    cliffYears: number,
  ) => {
    // クリフ期間中は0
    if (yearsElapsed < cliffYears) {
      return 0
    }

    const yearsAfterCliff = yearsElapsed - cliffYears
    const vestingYearsAfterCliff = totalVestingYears - cliffYears

    if (vestingYearsAfterCliff <= 0) {
      return totalShares
    }

    // リニア（均等）ベスティングのみ
    return Math.min(totalShares, (totalShares * yearsAfterCliff) / vestingYearsAfterCliff)
  }

  // 税金計算
  const calculateTax = (exerciseGain: number, saleGain: number, isQualified: boolean, holdingYears: number) => {
    let exerciseTax = 0
    let saleTax = 0
    let totalTax = 0
    let taxRate = 0

    if (isQualified) {
      // 税制適格ストックオプション
      if (holdingYears >= 2) {
        // 2年以上保有：譲渡所得として20.315%
        saleTax = (exerciseGain + saleGain) * 0.20315
        taxRate = 20.315
      } else {
        // 2年未満：給与所得として累進課税（簡易計算で30%と仮定）
        exerciseTax = exerciseGain * 0.3
        saleTax = saleGain * 0.20315
        taxRate = 30
      }
    } else {
      // 税制非適格ストックオプション
      // 行使時：給与所得として累進課税
      exerciseTax = exerciseGain * 0.3 // 簡易計算
      // 売却時：譲渡所得として20.315%
      saleTax = saleGain * 0.20315
      taxRate = 30
    }

    totalTax = exerciseTax + saleTax
    const netReturnAfterTax = exerciseGain + saleGain - totalTax

    return {
      exerciseTax,
      saleTax,
      totalTax,
      netReturnAfterTax,
      taxRate,
    }
  }

  const executeSimulation = async () => {
    setIsSimulating(true)

    await new Promise((resolve) => setTimeout(resolve, 1000))

    const outstanding = Number.parseInt(outstandingShares)
    const currentCap = Number.parseInt(currentMarketCap)
    const futureCap = Number.parseInt(futureMarketCap)
    const granted = Number.parseInt(grantedShares)
    const exercise = Number.parseInt(exercisePrice)
    const elapsed = yearsElapsed[0]
    const vestingYears = vestingPeriod[0]
    const cliffYears = cliffPeriod[0]

    // 株価計算
    const currentStockPrice = currentCap / outstanding
    const futureStockPrice = futureCap / outstanding

    // ベスティング計算
    const vestedShares = calculateVestedShares(granted, elapsed, vestingYears, cliffYears)

    // ベスティングスケジュール生成
    const vestingScheduleData = []
    for (let year = 1; year <= Math.max(vestingYears, elapsed); year++) {
      const yearVested = calculateVestedShares(granted, year, vestingYears, cliffYears)
      const prevYearVested = year > 1 ? calculateVestedShares(granted, year - 1, vestingYears, cliffYears) : 0

      vestingScheduleData.push({
        year,
        vestedShares: yearVested - prevYearVested,
        cumulativeVestedShares: yearVested,
        isCliffPeriod: year <= cliffYears,
      })
    }

    // リターン計算（権利確定済み株式のみ）
    const currentReturn = Math.max(0, currentStockPrice - exercise) * vestedShares
    const futureReturn = Math.max(0, futureStockPrice - exercise) * vestedShares

    // 付与％計算
    const grantedPercentageCalc = (granted / outstanding) * 100

    // 総価値計算
    const totalCurrentValue = currentStockPrice * vestedShares
    const totalFutureValue = futureStockPrice * vestedShares

    // 行使コスト
    const exerciseCost = exercise * vestedShares

    // 税金計算
    const exerciseGain = Math.max(0, currentStockPrice - exercise) * vestedShares
    const saleGain = Math.max(0, futureStockPrice - currentStockPrice) * vestedShares
    const isQualified = isTaxQualified === "qualified"
    const holdingYears = holdingPeriod[0]

    const taxCalculation = calculateTax(exerciseGain, saleGain, isQualified, holdingYears)

    setSimulationResult({
      currentStockPrice,
      futureStockPrice,
      currentReturn,
      futureReturn,
      grantedPercentage: grantedPercentageCalc,
      totalCurrentValue,
      totalFutureValue,
      exerciseCost,
      netCurrentReturn: currentReturn,
      netFutureReturn: futureReturn,
      vestedShares,
      vestingSchedule: vestingScheduleData,
      taxCalculation,
    })

    setIsSimulating(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー部分 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <img src="/rezon-logo.jpeg" alt="REZON" className="h-12 w-auto" />
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">株式報酬リターンシミュレーター</h1>
            <p className="text-gray-600">ベスティング・税制を考慮した株式報酬リターンを算出</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 左側：条件設定 */}
          <Card className="bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-blue-600" />
                条件設定
              </CardTitle>
              <p className="text-sm text-gray-600">企業情報と付与条件を入力してください</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 企業情報 */}
              <div className="space-y-4 p-4 bg-white rounded-lg border">
                <h3 className="font-semibold flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  企業情報
                </h3>

                <div>
                  <Label htmlFor="outstandingShares">発行済株式総数 (株)</Label>
                  <Input
                    id="outstandingShares"
                    value={formatInputNumber(outstandingShares)}
                    onChange={handleOutstandingSharesChange}
                    placeholder="10,000,000"
                  />
                </div>

                <div>
                  <Label htmlFor="currentMarketCap">現在時価総額 (円)</Label>
                  <Input
                    id="currentMarketCap"
                    value={formatInputNumber(currentMarketCap)}
                    onChange={handleCurrentMarketCapChange}
                    placeholder="50,000,000,000"
                  />
                </div>

                <div>
                  <Label htmlFor="futureMarketCap">将来時価総額 (円)</Label>
                  <Input
                    id="futureMarketCap"
                    value={formatInputNumber(futureMarketCap)}
                    onChange={handleFutureMarketCapChange}
                    placeholder="100,000,000,000"
                  />
                </div>
              </div>

              {/* 付与条件 */}
              <div className="space-y-4 p-4 bg-white rounded-lg border">
                <h3 className="font-semibold flex items-center gap-2">
                  <Percent className="w-4 h-4" />
                  付与条件
                </h3>

                <div>
                  <Label htmlFor="grantedShares">付与株式数 (株)</Label>
                  <Input
                    id="grantedShares"
                    value={formatInputNumber(grantedShares)}
                    onChange={handleGrantedSharesChange}
                    placeholder="50,000"
                  />
                </div>

                <div>
                  <Label htmlFor="exercisePrice">行使価額 (円)</Label>
                  <Input
                    id="exercisePrice"
                    value={formatInputNumber(exercisePrice)}
                    onChange={handleExercisePriceChange}
                    placeholder="1,000"
                  />
                </div>

                <div>
                  <Label htmlFor="grantedPercentage">付与％</Label>
                  <Input
                    id="grantedPercentage"
                    value={grantedPercentage}
                    onChange={(e) => handlePercentageChange(e.target.value)}
                    placeholder="0.10000000"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    <p>全発行済株式に対する付与株式の割合</p>
                    {outstandingShares && grantedShares && (
                      <p className="text-blue-600 font-mono">
                        計算: {formatInputNumber(grantedShares)} ÷ {formatInputNumber(outstandingShares)} × 100 ={" "}
                        {grantedPercentage}%
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* ベスティング設定 */}
              <div className="space-y-4 p-4 bg-white rounded-lg border">
                <h3 className="font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  ベスティング設定
                </h3>

                <div>
                  <Label>ベスティング期間: {vestingPeriod[0]}年</Label>
                  <Slider
                    value={vestingPeriod}
                    onValueChange={setVestingPeriod}
                    max={6}
                    min={1}
                    step={1}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label>クリフ期間: {cliffPeriod[0]}年</Label>
                  <Slider
                    value={cliffPeriod}
                    onValueChange={setCliffPeriod}
                    max={3}
                    min={0}
                    step={1}
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">この期間中は株式の権利確定なし</p>
                </div>

                <div>
                  <Label>経過年数: {yearsElapsed[0]}年</Label>
                  <Slider
                    value={yearsElapsed}
                    onValueChange={setYearsElapsed}
                    max={8}
                    min={0}
                    step={1}
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">現在までの経過年数</p>
                </div>
              </div>

              {/* 税制設定 */}
              <div className="space-y-4 p-4 bg-white rounded-lg border">
                <h3 className="font-semibold flex items-center gap-2">
                  <Receipt className="w-4 h-4" />
                  税制設定
                </h3>

                <div>
                  <Label>ストックオプション種類</Label>
                  <Select value={isTaxQualified} onValueChange={setIsTaxQualified}>
                    <SelectTrigger>
                      <SelectValue placeholder="種類を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="qualified">税制適格</SelectItem>
                      <SelectItem value="non-qualified">税制非適格</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    {isTaxQualified === "qualified" ? "2年以上保有で譲渡所得扱い" : "行使時に給与所得として課税"}
                  </p>
                </div>

                <div>
                  <Label>保有期間: {holdingPeriod[0]}年</Label>
                  <Slider
                    value={holdingPeriod}
                    onValueChange={setHoldingPeriod}
                    max={5}
                    min={0}
                    step={1}
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">行使から売却までの期間</p>
                </div>
              </div>

              <Button
                onClick={executeSimulation}
                className="w-full bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700"
                size="lg"
                disabled={isSimulating}
              >
                <Calculator className="w-4 h-4 mr-2" />
                {isSimulating ? "計算中..." : "リターンを計算"}
              </Button>
            </CardContent>
          </Card>

          {/* 右側：シミュレーション結果 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                {simulationResult ? "計算結果" : "計算待機中"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!simulationResult && !isSimulating && (
                <div className="flex flex-col items-center justify-center h-96 text-gray-500">
                  <Calculator className="w-16 h-16 mb-4 text-gray-300" />
                  <p className="text-center">
                    左側で条件を設定してリターンを計算を
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
                        <span className="text-sm font-medium text-yellow-800">ベスティング状況</span>
                      </div>
                      <div className="text-sm text-yellow-900">
                        <p>
                          権利確定済み: {formatNumber(simulationResult.vestedShares)}株 /{" "}
                          {formatNumber(Number.parseInt(grantedShares))}株
                        </p>
                        <p>
                          権利確定率:{" "}
                          {((simulationResult.vestedShares / Number.parseInt(grantedShares)) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* メインリターン表示 */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="bg-blue-50">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">現在リターン</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-900">
                          {formatCurrency(simulationResult.currentReturn)}
                        </p>
                        <p className="text-xs text-blue-700 mt-1">権利確定済み株式での利益</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-green-50">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium text-green-800">将来リターン</span>
                        </div>
                        <p className="text-2xl font-bold text-green-900">
                          {formatCurrency(simulationResult.futureReturn)}
                        </p>
                        <p className="text-xs text-green-700 mt-1">将来時価総額での利益</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* 税金計算結果 */}
                  <Card className="bg-red-50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Receipt className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-medium text-red-800">税金計算</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>行使時税金:</span>
                          <span className="font-medium">
                            {formatCurrency(simulationResult.taxCalculation.exerciseTax)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>売却時税金:</span>
                          <span className="font-medium">{formatCurrency(simulationResult.taxCalculation.saleTax)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="font-semibold">総税額:</span>
                          <span className="font-bold">{formatCurrency(simulationResult.taxCalculation.totalTax)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-semibold text-green-700">税引後利益:</span>
                          <span className="font-bold text-green-700">
                            {formatCurrency(simulationResult.taxCalculation.netReturnAfterTax)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 株価情報 */}
                  <Card className="bg-gray-50">
                    <CardContent className="p-4">
                      <h4 className="font-semibold mb-3">株価情報</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">現在の株価:</span>
                          <p className="font-bold text-lg">{formatCurrency(simulationResult.currentStockPrice)}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">将来の株価:</span>
                          <p className="font-bold text-lg">{formatCurrency(simulationResult.futureStockPrice)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ベスティングスケジュール表示 */}
        {simulationResult && (
          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  ベスティングスケジュール
                </CardTitle>
                <p className="text-sm text-gray-600">権利確定の推移とクリフ期間の詳細</p>
              </CardHeader>
              <CardContent>
                {/* ベスティング詳細情報 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <Card className="bg-yellow-50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-yellow-600" />
                        <span className="text-sm font-medium">現在の状況</span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <p>経過年数: {yearsElapsed[0]}年</p>
                        <p>権利確定済み: {formatNumber(simulationResult.vestedShares)}株</p>
                        <p>
                          権利確定率:{" "}
                          {((simulationResult.vestedShares / Number.parseInt(grantedShares)) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-orange-50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <BarChart3 className="w-4 h-4 text-orange-600" />
                        <span className="text-sm font-medium">ベスティング設定</span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <p>総期間: {vestingPeriod[0]}年</p>
                        <p>クリフ: {cliffPeriod[0]}年</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-purple-50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium">将来予測</span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <p>最終権利確定: {formatNumber(Number.parseInt(grantedShares))}株</p>
                        <p>残り期間: {Math.max(0, vestingPeriod[0] - yearsElapsed[0])}年</p>
                        <p>
                          残り権利確定: {formatNumber(Number.parseInt(grantedShares) - simulationResult.vestedShares)}株
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* 年次詳細テーブル */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">年次詳細</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-3">年</th>
                            <th className="text-right p-3">新規権利確定</th>
                            <th className="text-right p-3">累積権利確定</th>
                            <th className="text-right p-3">権利確定率</th>
                            <th className="text-center p-3">状態</th>
                          </tr>
                        </thead>
                        <tbody>
                          {simulationResult.vestingSchedule.map((year) => (
                            <tr
                              key={year.year}
                              className={`border-b hover:bg-gray-50 ${
                                year.year === yearsElapsed[0] ? "bg-blue-50 font-semibold" : ""
                              }`}
                            >
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  {year.year}年目
                                  {year.year === yearsElapsed[0] && (
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">現在</span>
                                  )}
                                </div>
                              </td>
                              <td className="text-right p-3">
                                <span className="font-mono">{formatNumber(year.vestedShares)}株</span>
                              </td>
                              <td className="text-right p-3">
                                <span className="font-mono">{formatNumber(year.cumulativeVestedShares)}株</span>
                              </td>
                              <td className="text-right p-3">
                                <span className="font-mono">
                                  {((year.cumulativeVestedShares / Number.parseInt(grantedShares)) * 100).toFixed(1)}%
                                </span>
                              </td>
                              <td className="text-center p-3">
                                {year.isCliffPeriod ? (
                                  <span className="text-xs bg-red-100 text-red-800 px-3 py-1 rounded-full">
                                    クリフ期間
                                  </span>
                                ) : (
                                  <span className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full">
                                    権利確定
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* 進捗バー表示 */}
                <div className="mt-6">
                  <Card className="bg-gradient-to-r from-blue-50 to-green-50">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold">権利確定進捗</h4>
                        <span className="text-sm text-gray-600">
                          {((simulationResult.vestedShares / Number.parseInt(grantedShares)) * 100).toFixed(1)}% 完了
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-green-500 h-4 rounded-full transition-all duration-500"
                          style={{
                            width: `${(simulationResult.vestedShares / Number.parseInt(grantedShares)) * 100}%`,
                          }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>0株</span>
                        <span className="font-medium">現在: {formatNumber(simulationResult.vestedShares)}株</span>
                        <span>{formatNumber(Number.parseInt(grantedShares))}株</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
