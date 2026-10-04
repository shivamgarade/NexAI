import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import styles from './ModelSplitChart.module.scss';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899'];

const FEATURE_NAMES = {
  chat: 'Chat Assistant',
  library: 'Smart Library',
  docgen: 'Document Studio',
  document: 'Document Studio',
  interview: 'Mock Interview',
};

function CustomTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div className={styles.tooltip}>
        <p className={styles.tooltipTitle}>{item.name}</p>
        <p className={styles.tooltipValue}>
          <strong>{Number(item.value).toLocaleString()} tokens</strong>
        </p>
      </div>
    );
  }
  return null;
}

export function ModelSplitChart({
  data = [],
  featureSplit = [],
  activeModel = 'gemini-3.5-flash-lite',
}) {
  // Use real feature breakdown if available; fallback to data if provided
  let chartData = [];

  if (featureSplit && featureSplit.length > 0) {
    const totalFeatureTokens = featureSplit.reduce((acc, curr) => acc + (curr.tokens || 0), 0);
    chartData = featureSplit.map((f) => ({
      name: FEATURE_NAMES[f.feature] || f.feature,
      value: f.tokens || 0,
      percentage: totalFeatureTokens > 0 ? Math.round((f.tokens / totalFeatureTokens) * 100) : 0,
    }));
  } else if (data && data.length > 0) {
    const totalModelTokens = data.reduce((acc, curr) => acc + (curr.tokens || 0), 0);
    chartData = data.map((d) => ({
      name: d.name,
      value: d.tokens,
      percentage: totalModelTokens > 0 ? Math.round((d.tokens / totalModelTokens) * 100) : d.percentage || 0,
    }));
  }

  const totalTokens = chartData.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>AI Feature Distribution</h3>
        <p className={styles.subtitle}>Token consumption breakdown across platform capabilities</p>
        <div className={styles.engineBadge}>
          <Sparkles size={12} />
          <span>Active Engine: {activeModel}</span>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.pieContainer}>
          {totalTokens === 0 ? (
            <div className={styles.empty}>No tokens consumed for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className={styles.legend}>
          {chartData.length === 0 ? (
            <div className={styles.empty}>No active features recorded</div>
          ) : (
            chartData.map((item, index) => (
              <div key={item.name} className={styles.legendItem}>
                <div className={styles.legendLeft}>
                  <span
                    className={styles.indicator}
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className={styles.legendName}>{item.name}</span>
                </div>
                <div className={styles.legendRight}>
                  <span className={styles.legendPercent}>{item.percentage}%</span>
                  <span className={styles.legendTokens}>
                    {Number(item.value).toLocaleString()} tokens
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}

