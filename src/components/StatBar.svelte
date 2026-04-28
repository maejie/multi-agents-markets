<script lang="ts">
  import type { MonthlyMetrics } from '../simulation/types';

  export let current: MonthlyMetrics | null = null;
  export let month: number = 0;

  interface StatCard {
    label: string;
    value: string | number;
    color: string;
    icon: string;
  }

  $: cards = current ? [
    { label: 'Month', value: month, color: '#60a5fa', icon: '📅' },
    { label: 'Agents', value: current.agentCount, color: '#a78bfa', icon: '👥' },
    { label: 'In Use', value: current.vehiclesInUse, color: '#10b981', icon: '🚗' },
    { label: 'For Sale', value: current.vehiclesForSale, color: '#f59e0b', icon: '🏷️' },
    { label: 'New Sales', value: current.newCarSales, color: '#34d399', icon: '🆕' },
    { label: 'Used Sales', value: current.usedCarSales, color: '#22d3ee', icon: '🔄' },
    {
      label: 'Avg Used ¥',
      value: current.avgUsedPrice !== null ? current.avgUsedPrice.toFixed(1) : '—',
      color: '#fbbf24',
      icon: '💰',
    },
    { label: 'Disposed', value: current.vehiclesDisposed, color: '#64748b', icon: '♻️' },
  ] as StatCard[] : [] as StatCard[];
</script>

<div class="stat-bar">
  {#each cards as card}
    <div class="stat-card">
      <span class="stat-icon">{card.icon}</span>
      <div class="stat-info">
        <div class="stat-value" style="color: {card.color}">{card.value}</div>
        <div class="stat-label">{card.label}</div>
      </div>
    </div>
  {/each}
</div>

<style>
  .stat-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .stat-card {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 8px;
    padding: 8px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 90px;
  }
  .stat-icon { font-size: 18px; }
  .stat-value { font-size: 18px; font-weight: 700; line-height: 1; }
  .stat-label { font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; }
</style>
