<script lang="ts">
  export let title = '';
  export let icon = '';
  export let open = false;

  function toggle() {
    open = !open;
  }
</script>

<div class="section">
  <button class="section-header" on:click={toggle}>
    <span class="section-left">
      <span class="section-icon">{icon}</span>
      <span class="section-title">{title}</span>
    </span>
    <span class="chevron" class:open>{open ? '▲' : '▼'}</span>
  </button>
  {#if open}
    <div class="section-body">
      <slot />
    </div>
  {/if}
</div>

<style>
  .section {
    border-bottom: 1px solid #1e293b;
  }
  .section-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: #e2e8f0;
    text-align: left;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    min-height: 48px;
  }
  .section-header:active {
    background: rgba(255, 255, 255, 0.05);
  }
  .section-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .section-icon { font-size: 16px; }
  .section-title { font-size: 13px; font-weight: 600; }
  .chevron { color: #64748b; font-size: 11px; }
  .chevron.open { color: #60a5fa; }
  .section-body {
    padding: 4px 12px 14px;
  }
</style>
