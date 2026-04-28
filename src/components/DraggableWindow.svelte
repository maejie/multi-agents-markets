<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let title = 'Window';
  export let x = 20;
  export let y = 20;
  export let width = 320;
  export let height = 240;
  export let zIndex = 10;
  export let minWidth = 220;
  export let minHeight = 140;

  const dispatch = createEventDispatcher<{ focus: void }>();

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = x;
  let startTop = y;
  let resizing = false;
  let resizeStartW = width;
  let resizeStartH = height;
  let minimized = false;

  function onHeaderDown(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('.min-btn')) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = x;
    startTop = y;
    dispatch('focus');
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
    e.preventDefault();
  }

  function onDragMove(e: MouseEvent) {
    if (dragging) {
      x = startLeft + (e.clientX - startX);
      y = startTop + (e.clientY - startY);
      return;
    }

    if (resizing) {
      width = Math.max(minWidth, resizeStartW + (e.clientX - startX));
      height = Math.max(minHeight, resizeStartH + (e.clientY - startY));
    }
  }

  function onDragEnd() {
    dragging = false;
    resizing = false;
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
  }

  function onResizeStart(e: MouseEvent) {
    resizing = true;
    startX = e.clientX;
    startY = e.clientY;
    resizeStartW = width;
    resizeStartH = height;
    dispatch('focus');
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
    e.preventDefault();
    e.stopPropagation();
  }

  function toggleMinimize() {
    minimized = !minimized;
  }

  function noop() {
    // Accessibility no-op for keyboard interaction hooks.
  }
</script>

<div
  class="win"
  style="left:{x}px; top:{y}px; width:{width}px; height:{minimized ? 34 : height}px; z-index:{zIndex};"
>
  <div
    class="win-header"
    on:mousedown={(e) => { dispatch('focus'); onHeaderDown(e); }}
    on:keydown={noop}
    role="button"
    tabindex="0"
  >
    <span class="title">{title}</span>
    <div class="header-right">
      <button class="min-btn" on:click|stopPropagation={toggleMinimize} aria-label="toggle minimize">
        {#if minimized}▢{:else}—{/if}
      </button>
    </div>
  </div>
  {#if !minimized}
    <div class="win-body">
      <slot />
    </div>
    <div
      class="resize-handle"
      on:mousedown={onResizeStart}
      on:keydown={noop}
      role="button"
      tabindex="0"
      aria-label="resize window"
    ></div>
  {/if}
</div>

<style>
  .win {
    position: absolute;
    border-radius: 10px;
    border: 1px solid #334155;
    background: rgba(2, 6, 23, 0.9);
    backdrop-filter: blur(6px);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
    overflow: hidden;
    color: #e2e8f0;
  }

  .win-header {
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px;
    background: linear-gradient(180deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95));
    border-bottom: 1px solid #1e293b;
    cursor: move;
    user-select: none;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .title {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .min-btn {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: 1px solid #334155;
    background: #0f172a;
    color: #94a3b8;
    cursor: pointer;
    line-height: 1;
    font-size: 12px;
  }

  .min-btn:hover {
    background: #1e293b;
    color: #e2e8f0;
  }

  .win-body {
    height: calc(100% - 34px);
    overflow: auto;
    padding: 10px;
  }

  .resize-handle {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 16px;
    height: 16px;
    cursor: nwse-resize;
    background: linear-gradient(135deg, transparent 50%, #334155 50%);
  }
</style>
