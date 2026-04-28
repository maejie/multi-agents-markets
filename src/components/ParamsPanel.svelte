<script lang="ts">
  import type { SimParams } from '../simulation/types';
  import { DEFAULT_PARAMS } from '../simulation/types';
  import { createEventDispatcher } from 'svelte';

  export let params: SimParams = { ...DEFAULT_PARAMS };
  export let disabled = false;

  const dispatch = createEventDispatcher<{ change: SimParams }>();

  function update() {
    dispatch('change', { ...params });
  }

  function pct(val: number) {
    return Math.round(val * 100);
  }
  function fromPct(e: Event, key: keyof SimParams) {
    const v = parseFloat((e.target as HTMLInputElement).value) / 100;
    (params as any)[key] = v;
    update();
  }

  function fromValue(e: Event, key: keyof SimParams) {
    (params as any)[key] = (e.target as HTMLInputElement | HTMLSelectElement).value;
    update();
  }
</script>

<div class="params-panel">
  <div class="panel-title">⚙️ Parameters</div>

  <div class="param-row">
    <label for="p-seed">Seed</label>
    <input id="p-seed" type="number" bind:value={params.seed} on:change={update} {disabled} />
  </div>

  <div class="param-row">
    <label for="p-need">Need Probability <span class="val">{pct(params.needProbability)}%</span></label>
    <input id="p-need" type="range" min="1" max="30" step="1"
      value={pct(params.needProbability)}
      on:input={(e) => fromPct(e, 'needProbability')}
      {disabled} />
  </div>

  <div class="param-row">
    <label for="p-sell">Sell Probability <span class="val">{pct(params.sellProbability)}%</span></label>
    <input id="p-sell" type="range" min="1" max="20" step="1"
      value={pct(params.sellProbability)}
      on:input={(e) => fromPct(e, 'sellProbability')}
      {disabled} />
  </div>

  <div class="param-row">
    <label for="p-ratio">New Car Ratio <span class="val">{pct(params.newCarRatio)}%</span></label>
    <input id="p-ratio" type="range" min="0" max="100" step="5"
      value={pct(params.newCarRatio)}
      on:input={(e) => fromPct(e, 'newCarRatio')}
      {disabled} />
  </div>

  <div class="param-row">
    <label for="p-agents">Initial Agents</label>
    <input id="p-agents" type="number" min="10" max="500" bind:value={params.initialAgents} on:change={update} {disabled} />
  </div>

  <div class="param-row">
    <label for="p-price">Base Vehicle Price</label>
    <input id="p-price" type="number" min="50" max="500" bind:value={params.baseVehiclePrice} on:change={update} {disabled} />
  </div>

  <div class="param-row">
    <label for="p-birth-strategy">Birth Strategy</label>
    <select
      id="p-birth-strategy"
      bind:value={params.birthStrategy}
      on:change={(e) => fromValue(e, 'birthStrategy')}
      {disabled}
    >
      <option value="none">No New Agents</option>
      <option value="periodic">Periodic Birth</option>
    </select>
  </div>

  {#if params.birthStrategy === 'periodic'}
    <div class="param-row">
      <label for="p-birth-interval">Birth Interval (months)</label>
      <input
        id="p-birth-interval"
        type="number"
        min="1"
        max="24"
        bind:value={params.birthIntervalMonths}
        on:change={update}
        {disabled}
      />
    </div>
  {/if}
</div>

<style>
  .params-panel {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 8px;
    padding: 12px;
  }
  .panel-title {
    font-size: 11px;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 12px;
  }
  .param-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 10px;
  }
  label {
    font-size: 11px;
    color: #94a3b8;
    display: flex;
    justify-content: space-between;
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
    width: 14px;
    height: 14px;
    background: #f59e0b;
    border-radius: 50%;
    cursor: pointer;
  }
  input[type="range"]:disabled { opacity: 0.4; cursor: not-allowed; }
  input[type="number"] {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 4px;
    color: #e2e8f0;
    padding: 4px 8px;
    font-size: 12px;
    width: 80px;
  }
  select {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 4px;
    color: #e2e8f0;
    padding: 6px 8px;
    font-size: 12px;
    width: 100%;
  }
  input[type="number"]:disabled { opacity: 0.4; }
  select:disabled { opacity: 0.4; }
</style>
