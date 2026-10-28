import React, { memo } from 'react'
import {
  LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'

export const PALETTE = ['#38bdf8', '#818cf8', '#34d399', '#f59e0b', '#ec4899', '#a78bfa']

export const COLOR_MAP = {
  'total':              '#38bdf8',
  'Total':              '#38bdf8',
  'Laboratory Block B': '#f59e0b',
  'LB-B':               '#f59e0b',
  'Classroom Block A':  '#60a5fa',
  'CB-A':               '#60a5fa',
  'Hostel Complex':     '#a78bfa',
  'HST':                '#a78bfa',
  'Central Library':    '#34d399',
  'LIB':                '#34d399',
}

function LineChartComponent({
  data = [],
  keys = ['total'],
  xKey = 'date',
  height = 320,
  refLine,
  isAnimationActive = false,
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReLineChart
        data={data}
        margin={{ top: 12, right: 20, left: 8, bottom: 4 }}
      >
        <defs>
          {keys.map((key, i) => {
            const clr = COLOR_MAP[key] || PALETTE[i % PALETTE.length]
            return (
              <linearGradient key={key} id={`lg-${i}-${key.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={clr} stopOpacity={0.2} />
                <stop offset="95%" stopColor={clr} stopOpacity={0} />
              </linearGradient>
            )
          })}
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
          minTickGap={24}
          interval="preserveStartEnd"
          tickFormatter={(v) => {
            if (!v) return ''
            const s = String(v)
            if (s.length === 7 && s.includes('-')) {
              // YYYY-MM
              const [y, m] = s.split('-')
              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
              const mIdx = parseInt(m, 10) - 1
              return `${months[mIdx] || m} '${y.slice(2)}`
            }
            if (s.length >= 10 && s.includes('-')) {
              // YYYY-MM-DD
              const parts = s.split('-')
              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
              const mIdx = parseInt(parts[1], 10) - 1
              return `${months[mIdx] || parts[1]} ${parts[2]}`
            }
            return s
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
          formatter={(v, name) => {
            const num = Number(v)
            const formatted = num >= 1_000
              ? num.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })
              : num.toFixed(2)
            return [`${formatted} kWh`, name]
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
        {keys.length > 1 && (
          <Legend
            wrapperStyle={{ paddingTop: 14, fontSize: '12px' }}
            iconType="circle"
          />
        )}
        {refLine && (
          <ReferenceLine
            y={refLine}
            stroke="#ef4444"
            strokeDasharray="4 4"
            label={{ value: `Threshold (${refLine} kWh)`, fill: '#ef4444', fontSize: 10, position: 'top' }}
          />
        )}
        {keys.map((key, i) => {
          const clr = COLOR_MAP[key] || PALETTE[i % PALETTE.length]
          return (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={clr}
              strokeWidth={2.2}
              dot={false}
              isAnimationActive={isAnimationActive}
              activeDot={{
                r: 5,
                stroke: clr,
                strokeWidth: 2,
                fill: '#111827',
              }}
            />
          )
        })}
      </ReLineChart>
    </ResponsiveContainer>
  )
}

export default memo(LineChartComponent)
