<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, BarController, BarElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js';
  import type { MonthlyMetrics } from '../simulation/types';

  Chart.register(BarController, BarElement, LinearScale, CategoryScale, Tooltip, Legend);

  export let metrics: MonthlyMetrics[] = [];

  let canvasEl: HTMLCanvasElement;
  let chart: Chart;

  onMount(() => {
    const ctx = canvasEl.getContext('2d')!;
    chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            label: 'In Use',
            data: [],
            backgroundColor: '#10b981',
            stack: 'vehicles',
          },
          {
            label: 'For Sale',
            data: [],
            backgroundColor: '#f59e0b',
            stack: 'vehicles',
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
        },
        scales: {
          x: {
            stacked: true,
            ticks: { color: '#64748b', maxTicksLimit: 12, font: { size: 10 } },
            grid: { color: '#1e293b' },
          },
          y: {
            stacked: true,
            ticks: { color: '#94a3b8', font: { size: 10 } },
            grid: { color: '#1e293b' },
            title: { display: true, text: 'Vehicles', color: '#94a3b8', font: { size: 10 } },
          },
        },
      },
    });
  });

  onDestroy(() => chart?.destroy());

  $: if (chart && metrics.length > 0) {
    const last = metrics.slice(-60);
    chart.data.labels = last.map(m => `M${m.month}`);
    chart.data.datasets[0].data = last.map(m => m.vehiclesInUse);
    chart.data.datasets[1].data = last.map(m => m.vehiclesForSale);
    chart.update('none');
  }
</script>

<div class="lifecycle-chart">
  <canvas bind:this={canvasEl} height="160"></canvas>
</div>

<style>
  .lifecycle-chart {
    background: #0f172a;
    border-radius: 8px;
    border: 1px solid #1e293b;
    padding: 8px;
  }
</style>
