interface SparklineProps {
  data: number[]
  color?: string
  height?: number
  width?: number
}

export function Sparkline({ data, color = '#5BA4F5', height = 32, width = 64 }: SparklineProps) {
  if (!data || data.length < 2) return <div style={{ width, height }} />

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  const pad = 2
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2)
    const y = pad + ((1 - (v - min) / range) * (height - pad * 2))
    return `${x},${y}`
  })

  const polyline = pts.join(' ')
  const fillPath = `M ${pts[0]} L ${pts.slice(1).join(' L ')} L ${width - pad},${height - pad} L ${pad},${height - pad} Z`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
      <defs>
        <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#sg-${color.replace('#', '')})`} />
      <polyline points={polyline} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
