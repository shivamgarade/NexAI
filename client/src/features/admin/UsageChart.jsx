import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import styles from './UsageChart.module.scss';

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className={styles.tooltip}>
        <p className={styles.tooltipLabel}>{label}</p>
        {payload.map((item, index) => (
          <p key={index} className={styles.tooltipRow} style={{ color: item.color }}>
            <span>{item.name}:</span>
            <strong>{Number(item.value).toLocaleString()} tokens</strong>
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export function UsageChart({ data = [], range = '7d', onRangeChange, modelName = 'gemini-3.5-flash-lite' }) {
  const chartData = data.map((d) => ({
    date: d.date,
    label: d.date.slice(5), // MM-DD
    'Tokens Consumed': d.totalTokens,
  }));

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Token Consumption</h3>
          <p className={styles.subtitle}>Daily AI token consumption ({modelName})</p>
        </div>
        {onRangeChange && (
          <div className={styles.rangeTabs}>
            <button
              type="button"
              className={`${styles.rangeButton} ${range === '7d' ? styles.active : ''}`}
              onClick={() => onRangeChange('7d')}
            >
              7 Days
            </button>
            <button
              type="button"
              className={`${styles.rangeButton} ${range === '30d' ? styles.active : ''}`}
              onClick={() => onRangeChange('30d')}
            >
              30 Days
            </button>
          </div>
        )}
      </div>

      <div className={styles.chartContainer}>
        {chartData.length === 0 ? (
          <div className={styles.empty}>No usage data recorded for this period</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="var(--color-text-muted)"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                stroke="var(--color-text-muted)"
                fontSize={12}
                tickLine={false}
                tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} />
              <Area
                type="monotone"
                dataKey="Tokens Consumed"
                stroke="#10b981"
                fillOpacity={1}
                fill="url(#colorTokens)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

