import React, { memo } from 'react'
import {
  PieChart as RePieChart, Pie, Cell, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'

export const BUILDING_COLOR_MAP = {
  'Laboratory Block B': '#f59e0b',
  'LB-B': '#f59e0b',
  'Classroom Block A': '#60a5fa',
  'CB-A': '#60a5fa',
  'Hostel Complex': '#a78bfa',
  'HST': '#a78bfa',
  'Central Library': '#34d399',
  'LIB': '#34d399',
}

const FALLBACK_PALETTE = ['#f59e0b', '#60a5fa', '#a78bfa', '#34d399', '#ec4899', '#06b6d4']
const RADIAN = Math.PI / 180

const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  // Show labels for all slices with at least 1.5% share
  if (!percent || percent < 0.015) return null
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={700}
    >
      {`${(percent * 100).toFixed(1)}%`}
    </text>
  )
}

const CustomLegend = ({ payload, totalVal }) => (
  <ul className="flex flex-col gap-2 pl-2 mt-1">
    {payload?.map((entry, i) => {
      const val = entry.payload?.value || 0
      const pct = totalVal > 0 ? ((val / totalVal) * 100).toFixed(1) : ''
      return (
        <li key={i} className="flex items-center justify-between text-[11px] gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ background: entry.color }}
            />
            <span className="text-slate-300 font-medium truncate">{entry.value}</span>
          </div>
          {pct && (
            <span className="font-mono font-bold text-white shrink-0 ml-2">
              {pct}%
            </span>
          )}
        </li>
      )
    })}
  </ul>
)

function PieChartComponent({
  data = [],
  nameKey = 'name',
  valueKey = 'value',
  height = 280,
}) {
  const totalVal = React.useMemo(() => {
    return data.reduce((sum, item) => sum + (Number(item[valueKey]) || 0), 0)
  }, [data, valueKey])

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RePieChart>
        <defs>
          {data.map((entry, i) => {
            const clr = BUILDING_COLOR_MAP[entry[nameKey]] || FALLBACK_PALETTE[i % FALLBACK_PALETTE.length]
            return (
              <radialGradient key={i} id={`donut-grad-${i}`}>
                <stop offset="0%" stopColor={clr} stopOpacity={1} />
                <stop offset="100%" stopColor={clr} stopOpacity={0.8} />
              </radialGradient>
            )
          })}
        </defs>
        <Pie
          data={data}
          dataKey={valueKey}
          nameKey={nameKey}
          cx="38%"
          cy="50%"
          outerRadius="80%"
          innerRadius="48%"
          paddingAngle={3}
          labelLine={false}
          label={CustomLabel}
          strokeWidth={0}
        >
          {data.map((entry, i) => {
            const clr = BUILDING_COLOR_MAP[entry[nameKey]] || FALLBACK_PALETTE[i % FALLBACK_PALETTE.length]
            return (
              <Cell key={i} fill={`url(#donut-grad-${i})`} stroke={clr} strokeWidth={1} />
            )
          })}
        </Pie>
        <Tooltip
          formatter={(v, name) => {
            const num = Number(v)
            const formattedKwh = num >= 1_000
              ? num.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })
              : num.toFixed(2)
            const pct = totalVal > 0 ? ((num / totalVal) * 100).toFixed(1) : '0.0'
            return [`${formattedKwh} kWh (${pct}%)`, name]
          }}
          contentStyle={{
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '10px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            fontSize: '12px',
            color: '#f3f4f6',
            backdropFilter: 'blur(8px)',
          }}
        />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          content={<CustomLegend totalVal={totalVal} />}
        />
      </RePieChart>
    </ResponsiveContainer>
  )
}

export default memo(PieChartComponent)
