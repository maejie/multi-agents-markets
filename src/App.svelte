
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { wrap } from 'comlink';
  import type { Remote } from 'comlink';
  import type { SimWorkerApi } from './simulation/worker';
  import type { SimState, SimParams } from './simulation/types';
  import { DEFAULT_PARAMS } from './simulation/types';

  import MarketView from './components/MarketView.svelte';
  import PriceChart from './components/PriceChart.svelte';
  import LifecycleChart from './components/LifecycleChart.svelte';
  import EventLog from './components/EventLog.svelte';
  import StatBar from './components/StatBar.svelte';
  import ParamsPanel from './components/ParamsPanel.svelte';
  import DraggableWindow from './components/DraggableWindow.svelte';

  let worker: Worker;
  let api: Remote<SimWorkerApi>;

  let simState: SimState | null = null;
  let activeParams: SimParams = { ...DEFAULT_PARAMS };
  let draftParams: SimParams = { ...DEFAULT_PARAMS };
  let running = false;
  let tickTimer: ReturnType<typeof setTimeout> | null = null;
  let speedMs = 300;
  let zTop = 20;
  let zControl = 21;
  let zParams = 22;
  let zMetrics = 23;
  let zCharts = 24;
  let zEvents = 25;

  const controlW = 300;
  const controlH = 230;
  const paramsW = 300;
  const paramsH = 460;
  const metricsW = 890;
  const metricsH = 130;
  const chartsW = 890;
  const chartsH = 360;
  const eventsW = 420;
  const eventsH = 760;

  let controlX = 16;
  let controlY = 76;
  let paramsX = 16;
  let paramsY = 320;
  let metricsX = 340;
  let metricsY = 16;
  let chartsX = 340;
  let chartsY = 160;
  let eventsX = 1240;
  let eventsY = 16;

  function bringToFront(name: 'control' | 'params' | 'metrics' | 'charts' | 'events') {
    zTop += 1;
    if (name === 'control') zControl = zTop;
    if (name === 'params') zParams = zTop;
    if (name === 'metrics') zMetrics = zTop;
    if (name === 'charts') zCharts = zTop;
    if (name === 'events') zEvents = zTop;
  }

  onMount(async () => {
    worker = new Worker(new URL('./simulation/worker.ts', import.meta.url), { type: 'module' });
    api = wrap<SimWorkerApi>(worker);
    simState = await api.init(activeParams);

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    eventsX = Math.max(16, vw - eventsW - 16);
    chartsY = Math.max(120, vh - chartsH - 16);
  });

  onDestroy(() => {
    stopSim();
    worker?.terminate();
  });

  async function initSim() {
    stopSim();
    simState = await api.init(activeParams);
  }

  async function applySettings() {
    stopSim();
    activeParams = { ...draftParams };
    simState = await api.init(activeParams);
  }

  async function stepOnce() {
    if (!simState) return;
    simState = await api.step(activeParams);
  }

  function startSim() {
    if (running) return;
    running = true;
    scheduleTick();
  }

  function stopSim() {
    running = false;
    if (tickTimer) { clearTimeout(tickTimer); tickTimer = null; }
  }

  function scheduleTick() {
    if (!running) return;
    tickTimer = setTimeout(async () => {
      await stepOnce();
      scheduleTick();
    }, speedMs);
  }

  function onParamsChange(e: CustomEvent<SimParams>) {
    draftParams = e.detail;
  }

  $: currentMetrics = simState?.metrics.at(-1) ?? null;
  $: allEvents = simState?.allEvents ?? [];
  $: hasPendingChanges = JSON.stringify(draftParams) !== JSON.stringify(activeParams);
</script>

<main>
  <MarketView state={simState} />

  <div class="title-badge">
    <div class="title">VLT Market Simulator</div>
    <div class="subtitle">Full-screen Agent Map with movable windows</div>
  </div>

  <DraggableWindow title="操作ウィンドウ" x={controlX} y={controlY} width={controlW} height={controlH} zIndex={zControl} on:focus={() => bringToFront('control')}>
    <div class="controls">
      <button class="btn btn-green" on:click={startSim} disabled={running}>Play</button>
      <button class="btn btn-red" on:click={stopSim} disabled={!running}>Pause</button>
      <button class="btn btn-blue" on:click={stepOnce} disabled={running}>+1 Month</button>
      <button class="btn btn-ghost" on:click={initSim} disabled={running}>Reset</button>
    </div>

    <button class="btn btn-apply" on:click={applySettings} disabled={running || !hasPendingChanges}>
      Apply Settings
    </button>

    {#if hasPendingChanges}
      <div class="pending-note">Changes pending. Apply Settings restarts with draft values.</div>
    {/if}

    <div class="speed-row">
      <label for="speed-slider">Speed <span class="val">{speedMs}ms/step</span></label>
      <input id="speed-slider" type="range" min="50" max="2000" step="50" bind:value={speedMs} />
    </div>
  </DraggableWindow>

  <DraggableWindow title="パラメーター設定ウィンドウ" x={paramsX} y={paramsY} width={paramsW} height={paramsH} zIndex={zParams} on:focus={() => bringToFront('params')}>
    <ParamsPanel params={draftParams} disabled={running} on:change={onParamsChange} />
  </DraggableWindow>

  <DraggableWindow title="概要メトリクスウィンドウ" x={metricsX} y={metricsY} width={metricsW} height={metricsH} zIndex={zMetrics} on:focus={() => bringToFront('metrics')}>
    <StatBar current={currentMetrics} month={simState?.month ?? 0} />
  </DraggableWindow>

  <DraggableWindow title="チャートウィンドウ" x={chartsX} y={chartsY} width={chartsW} height={chartsH} zIndex={zCharts} on:focus={() => bringToFront('charts')}>
    <div class="charts-row">
      <div class="chart-col">
        <div class="section-label">Price and Sales</div>
        <PriceChart metrics={simState?.metrics ?? []} />
      </div>
      <div class="chart-col">
        <div class="section-label">Vehicle Lifecycle</div>
        <LifecycleChart metrics={simState?.metrics ?? []} />
      </div>
    </div>
  </DraggableWindow>

  <DraggableWindow title="イベントログウィンドウ" x={eventsX} y={eventsY} width={eventsW} height={eventsH} zIndex={zEvents} on:focus={() => bringToFront('events')}>
    <EventLog events={allEvents} />
  </DraggableWindow>
</main>

<style>
  :global(body) {
    background: #020617;
    color: #e2e8f0;
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
  main {
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }
  .title-badge {
    position: absolute;
    left: 16px;
    top: 12px;
    z-index: 40;
    background: rgba(2, 6, 23, 0.75);
    border: 1px solid #334155;
    border-radius: 10px;
    padding: 8px 12px;
    backdrop-filter: blur(6px);
  }
  .title {
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 0.02em;
    color: #f8fafc;
  }
  .subtitle {
    font-size: 11px;
    color: #94a3b8;
  }
  .controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    margin-bottom: 8px;
  }
  .btn {
    border: none;
    border-radius: 6px;
    padding: 7px 4px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
  }
  .btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .btn:not(:disabled):hover { opacity: 0.85; }
  .btn:not(:disabled):active { transform: scale(0.97); }
  .btn-green { background: #10b981; color: #fff; }
  .btn-red { background: #ef4444; color: #fff; }
  .btn-blue { background: #3b82f6; color: #fff; }
  .btn-ghost { background: #1e293b; color: #94a3b8; border: 1px solid #334155; }
  .btn-apply {
    width: 100%;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: #fff;
    box-shadow: 0 8px 20px rgba(245, 158, 11, 0.2);
    margin-bottom: 8px;
  }
  .pending-note {
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.25);
    color: #fcd34d;
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 11px;
    line-height: 1.4;
    margin-bottom: 8px;
  }
  .speed-row {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 8px;
    padding: 10px 12px;
  }
  .speed-row label {
    font-size: 11px;
    color: #94a3b8;
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
  }
  .val { color: #f59e0b; font-weight: 600; }
  input[type="range"] {
    -webkit-appearance: none;
    width: 100%;
    height: 4px;
    background: #1e293b;
    border-radius: 2px;
    outline: none;
  }
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px; height: 14px;
    background: #f59e0b;
    border-radius: 50%;
    cursor: pointer;
  }
  .chart-col { min-width: 0; }
  .charts-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 6px;
  }
  .section-label {
    font-size: 11px;
    color: #475569;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
</style>
