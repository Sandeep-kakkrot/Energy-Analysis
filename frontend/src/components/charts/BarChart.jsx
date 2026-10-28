import React, { memo } from 'react'
import {
  BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'

export const PALETTE = ['#f59e0b', '#60a5fa', '#a78bfa', '#34d399', '#ec4899', '#06b6d4']

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

function BarChartComponent({
  data,
  keys,
  xKey = 'name',
  unit = 'kWh',
  height = 300,
  stacked = false,
  singleColor = false,
  isAnimationActive = false,
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart
        data={data}
        margin={{ top: 12, right: 20, left: 8, bottom: 4 }}
        barGap={6}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
          minTickGap={20}
          interval="preserveStartEnd"
          tickFormatter={(v) => {
            if (!v) return ''
            const s = String(v)
            return s.length >= 10 ? s.slice(5) : s
          }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          width={64}
          tickFormatter={(v) => {
            if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
            if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`
            return v >= 10 ? Math.round(v) : Number(v).toFixed(1)
          }}
        />
        <Tooltip
          isAnimationActive={false}
          formatter={(v, name, item) => {
            const num = Number(v)
            const formatted = num >= 1_000
              ? num.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })
              : num.toFixed(2)
            const label = item?.payload?.fullName || item?.payload?.name || name
            return [`${formatted} ${unit}`, label]
          }}
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
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
        {keys.length > 1 && (
          <Legend
            wrapperStyle={{ paddingTop: 14, fontSize: '12px' }}
            iconType="circle"
          />
        )}
        {keys.map((key, i) => {
          const defaultClr = BUILDING_COLOR_MAP[key] || PALETTE[i % PALETTE.length]
          return (
            <Bar
              key={key}
              dataKey={key}
              stackId={stacked ? 'stack' : undefined}
              fill={defaultClr}
              isAnimationActive={isAnimationActive}
              radius={
                stacked
                  ? i === keys.length - 1
                    ? [4, 4, 0, 0]
                    : [0, 0, 0, 0]
                  : [4, 4, 0, 0]
              }
              maxBarSize={48}
            >
              {singleColor &&
                data.map((entry, di) => {
                  const idKey = entry[xKey] || entry.name || entry.fullName || ''
                  const clr = BUILDING_COLOR_MAP[idKey] || BUILDING_COLOR_MAP[entry.fullName] || PALETTE[di % PALETTE.length]
                  return (
                    <Cell
                      key={di}
                      fill={clr}
                      opacity={0.95}
                    />
                  )
                })}
            </Bar>
          )
        })}
      </ReBarChart>
    </ResponsiveContainer>
  )
}

export default memo(BarChartComponent)
