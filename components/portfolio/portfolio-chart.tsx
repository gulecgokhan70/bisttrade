'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts'

const COLORS = ['#60B5FF', '#FF9149', '#FF9898', '#FF90BB', '#FF6363', '#80D8C3', '#A19AD3', '#72BF78']

export function PortfolioChart({ holdings, cashBalance }: { holdings: any[]; cashBalance: number }) {
  const chartData = useMemo(() => {
    const items = (holdings ?? []).map((h: any, i: number) => ({
      name: h?.stock?.symbol ?? 'Unknown',
      value: parseFloat((h?.currentValue ?? 0).toFixed(2)),
    }))
    if (cashBalance > 0) {
      items.push({ name: 'Nakit', value: parseFloat(cashBalance.toFixed(2)) })
    }
    return items
  }, [holdings, cashBalance])

  if ((chartData?.length ?? 0) === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Gösterilecek veri yok
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
        >
          {chartData.map((_: any, index: number) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
          formatter={(value: any) => [`₺${Number(value)?.toLocaleString?.('tr-TR') ?? '0'}`, '']}
        />
        <Legend
          verticalAlign="top"
          wrapperStyle={{ fontSize: 11 }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
