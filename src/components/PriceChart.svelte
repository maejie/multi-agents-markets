<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler } from 'chart.js';
  import type { MonthlyMetrics } from '../simulation/types';

  Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler);

  export let metrics: MonthlyMetrics[] = [];

  let canvasEl: HTMLCanvasElement;
  let chart: Chart;

  onMount(() => {
    const ctx = canvasEl.getContext('2d')!;
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Avg Used Price',
            data: [],
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245,158,11,0.1)',
            fill: true,
            tension: 0.3,
            yAxisID: 'yPrice',
          },
          {
            label: 'New Car Sales',
            data: [],
            borderColor: '#60a5fa',
            backgroundColor: 'rgba(96,165,250,0.1)',
            fill: false,
            tension: 0.3,
            yAxisID: 'yCount',
          },
          {
            label: 'Used Car Sales',
            data: [],
            borderColor: '#34d399',
            backgroundColor: 'rgba(52,211,153,0.1)',
            fill: false,
            tension: 0.3,
            yAxisID: 'yCount',
          },
        ],
      },
      options: {
        responsive: true,
        animation: false,
        plugins: {
          legend: {
            labels: { color: '#94a3b8', boxWidth: 12, font: { size: 11 } },
          },
          tooltip: { mode: 'index', intersect: false },
        },
        scales: {
          x: {
            ticks: { color: '#64748b', maxTicksLimit: 12, font: { size: 10 } },
            grid: { color: '#1e293b' },
          },
          yPrice: {
            type: 'linear',
            position: 'left',
            ticks: { color: '#f59e0b', font: { size: 10 } },
            grid: { color: '#1e293b' },
            title: { display: true, text: 'Price', color: '#94a3b8', font: { size: 10 } },
          },
          yCount: {
            type: 'linear',
            position: 'right',
            ticks: { color: '#94a3b8', font: { size: 10 } },
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Count', color: '#94a3b8', font: { size: 10 } },
          },
        },
      },
    });
  });

  onDestroy(() => chart?.destroy());

  $: if (chart && metrics.length > 0) {
    const last = metrics.slice(-60); // show last 60 months
    chart.data.labels = last.map(m => `M${m.month}`);
    chart.data.datasets[0].data = last.map(m => m.avgUsedPrice ?? null);
    chart.data.datasets[1].data = last.map(m => m.newCarSales);
    chart.data.datasets[2].data = last.map(m => m.usedCarSales);
    chart.update('none');
  }
</script>

<div class="price-chart">
  <canvas bind:this={canvasEl} height="180"></canvas>
</div>

<style>
  .price-chart {
    background: #0f172a;
    border-radius: 8px;
    border: 1px solid #1e293b;
    padding: 8px;
  }
</style>
