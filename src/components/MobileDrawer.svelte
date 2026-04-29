<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  let drawerHeight = 240;
  let isDragging = false;
  let dragStartY = 0;
  let dragStartH = 0;
  let maxH = 600;
  const MIN_HEIGHT = 48;
  let handleEl: HTMLDivElement;

  onMount(() => {
    maxH = Math.round(window.innerHeight * 0.88);
    handleEl.addEventListener('touchstart', onHandleTouchStart, { passive: true });
    handleEl.addEventListener('touchmove', onHandleTouchMove, { passive: false });
    handleEl.addEventListener('touchend', onHandleTouchEnd, { passive: true });
  });

  onDestroy(() => {
    handleEl?.removeEventListener('touchstart', onHandleTouchStart);
    handleEl?.removeEventListener('touchmove', onHandleTouchMove);
    handleEl?.removeEventListener('touchend', onHandleTouchEnd);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  });

  function onHandleMouseDown(e: MouseEvent) {
    isDragging = true;
    dragStartY = e.clientY;
    dragStartH = drawerHeight;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    e.preventDefault();
  }

  function onMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    drawerHeight = Math.max(MIN_HEIGHT, Math.min(maxH, dragStartH + (dragStartY - e.clientY)));
  }

  function onMouseUp() {
    isDragging = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  function onHandleTouchStart(e: TouchEvent) {
    isDragging = true;
    dragStartY = e.touches[0].clientY;
    dragStartH = drawerHeight;
  }

  function onHandleTouchMove(e: TouchEvent) {
    if (!isDragging) return;
    drawerHeight = Math.max(MIN_HEIGHT, Math.min(maxH, dragStartH + (dragStartY - e.touches[0].clientY)));
    e.preventDefault();
  }

  function onHandleTouchEnd() {
    isDragging = false;
  }
</script>

<div class="drawer" style="height: {drawerHeight}px">
  <div
    class="handle"
    bind:this={handleEl}
    on:mousedown={onHandleMouseDown}
    on:keydown={() => {}}
    role="button"
    tabindex="0"
    aria-label="ドロワーのサイズ変更"
  >
    <div class="handle-pill"></div>
  </div>
  <div class="drawer-scroll">
    <slot />
  </div>
</div>

<style>
  .drawer {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 50;
    background: rgba(2, 6, 23, 0.96);
    border-top: 1px solid #334155;
    border-radius: 16px 16px 0 0;
    backdrop-filter: blur(10px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.5);
  }
  .handle {
    flex-shrink: 0;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: ns-resize;
    touch-action: none;
    background: rgba(15, 23, 42, 0.8);
    border-bottom: 1px solid #1e293b;
    user-select: none;
  }
  .handle-pill {
    width: 44px;
    height: 4px;
    background: #475569;
    border-radius: 2px;
  }
  .drawer-scroll {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
</style>
