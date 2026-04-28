<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Application, Graphics, Text, TextStyle, Container } from 'pixi.js';
  import type { SimState } from '../simulation/types';

  export let state: SimState | null = null;

  let hostEl: HTMLDivElement;
  let canvasEl: HTMLCanvasElement;
  let app: Application;
  let worldContainer: Container;
  let resizeObserver: ResizeObserver;

  const CELL = 28;
  const PAD = 6;
  const MAX_AGENT_CONTAINER_WIDTH = 800;
  const VEHICLE_MARKET_HEIGHT = 200;
  const SIDE_CONTAINER_WIDTH = 200;
  const SIDE_CONTAINER_HEIGHT = 200;
  const PANEL_GAP = 14;
  const MIN_ZOOM = 0.4;
  const MAX_ZOOM = 4;

  let worldW = 0;
  let worldH = 0;
  let isPanning = false;
  let hasUserAdjustedView = false;
  let panStartX = 0;
  let panStartY = 0;
  let worldStartX = 0;
  let worldStartY = 0;

  onMount(async () => {
    app = new Application();
    await app.init({
      canvas: canvasEl,
      width: hostEl.clientWidth,
      height: hostEl.clientHeight,
      backgroundColor: 0x0f0f1a,
      antialias: true,
    });

    worldContainer = new Container();
    app.stage.addChild(worldContainer);

    resizeObserver = new ResizeObserver(() => {
      const w = hostEl.clientWidth;
      const h = hostEl.clientHeight;
      app.renderer.resize(w, h);
      if (state && worldContainer) drawGrid();
      if (!hasUserAdjustedView) resetView();
    });
    resizeObserver.observe(hostEl);

    hostEl.addEventListener('wheel', onWheel, { passive: false });
    hostEl.addEventListener('mousedown', onPanStart);
    window.addEventListener('mousemove', onPanMove);
    window.addEventListener('mouseup', onPanEnd);

    drawGrid();
    resetView();
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    hostEl?.removeEventListener('wheel', onWheel);
    hostEl?.removeEventListener('mousedown', onPanStart);
    window.removeEventListener('mousemove', onPanMove);
    window.removeEventListener('mouseup', onPanEnd);
    app?.destroy(false);
  });

  function resetView() {
    if (!app || !worldContainer || worldW <= 0 || worldH <= 0) return;
    const fitX = (app.renderer.width - 80) / worldW;
    const fitY = (app.renderer.height - 80) / worldH;
    const fitScale = Math.min(fitX, fitY, 1);
    const scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitScale));
    worldContainer.scale.set(scale);
    worldContainer.x = (app.renderer.width - worldW * scale) / 2;
    worldContainer.y = (app.renderer.height - worldH * scale) / 2;
  }

  function onPanStart(e: MouseEvent) {
    if (e.button !== 0) return;
    hasUserAdjustedView = true;
    isPanning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    worldStartX = worldContainer.x;
    worldStartY = worldContainer.y;
  }

  function onPanMove(e: MouseEvent) {
    if (!isPanning || !worldContainer) return;
    worldContainer.x = worldStartX + (e.clientX - panStartX);
    worldContainer.y = worldStartY + (e.clientY - panStartY);
  }

  function onPanEnd() {
    isPanning = false;
  }

  function onWheel(e: WheelEvent) {
    if (!worldContainer || !app) return;
    e.preventDefault();
    hasUserAdjustedView = true;

    const rect = hostEl.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const oldScale = worldContainer.scale.x;
    const nextScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldScale * (e.deltaY < 0 ? 1.1 : 0.9)));
    if (nextScale === oldScale) return;

    const worldX = (mouseX - worldContainer.x) / oldScale;
    const worldY = (mouseY - worldContainer.y) / oldScale;

    worldContainer.scale.set(nextScale);
    worldContainer.x = mouseX - worldX * nextScale;
    worldContainer.y = mouseY - worldY * nextScale;
  }

  function drawGrid() {
    worldContainer.removeChildren();
    if (!state) return;

    const agents = state.agents.filter(a => a.type === 'individual') as any[];
    const availableWidth = Math.min(
      MAX_AGENT_CONTAINER_WIDTH,
      Math.max(320, app?.renderer?.width ?? 320)
    );
    const colsByWidth = Math.floor((availableWidth - PAD * 2 + PAD) / (CELL + PAD));
    const cols = Math.max(1, colsByWidth);

    const gridRows = Math.max(1, Math.ceil(agents.length / cols));
    const gridW = cols * CELL + (cols - 1) * PAD;
    const gridH = gridRows * CELL + (gridRows - 1) * PAD;

    const panelW = PAD + gridW + PAD;
    const agentPanelH = PAD + gridH + 44;
    const agentPanelX = SIDE_CONTAINER_WIDTH + PANEL_GAP;
    const agentPanelY = 0;
    const vehiclePanelY = agentPanelY + agentPanelH + PANEL_GAP;

    worldW = SIDE_CONTAINER_WIDTH + PANEL_GAP + panelW + PANEL_GAP + SIDE_CONTAINER_WIDTH;
    worldH = vehiclePanelY + VEHICLE_MARKET_HEIGHT;

    const agentPanel = new Graphics();
    agentPanel.roundRect(agentPanelX, agentPanelY, panelW, agentPanelH, 12);
    agentPanel.fill(0x0b1120);
    agentPanel.stroke({ color: 0x233047, width: 2 });
    worldContainer.addChild(agentPanel);

    const vehiclePanel = new Graphics();
    vehiclePanel.roundRect(agentPanelX, vehiclePanelY, panelW, VEHICLE_MARKET_HEIGHT, 12);
    vehiclePanel.fill(0x0b1120);
    vehiclePanel.stroke({ color: 0x233047, width: 2 });
    worldContainer.addChild(vehiclePanel);

    const oemPanel = new Graphics();
    oemPanel.roundRect(0, vehiclePanelY, SIDE_CONTAINER_WIDTH, SIDE_CONTAINER_HEIGHT, 12);
    oemPanel.fill(0x0b1120);
    oemPanel.stroke({ color: 0x233047, width: 2 });
    worldContainer.addChild(oemPanel);

    const recyclerPanel = new Graphics();
    const recyclerX = agentPanelX + panelW + PANEL_GAP;
    recyclerPanel.roundRect(recyclerX, vehiclePanelY, SIDE_CONTAINER_WIDTH, SIDE_CONTAINER_HEIGHT, 12);
    recyclerPanel.fill(0x0b1120);
    recyclerPanel.stroke({ color: 0x233047, width: 2 });
    worldContainer.addChild(recyclerPanel);

    agents.forEach((agent, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = agentPanelX + PAD + col * (CELL + PAD);
      const y = agentPanelY + PAD + row * (CELL + PAD);

      const g = new Graphics();

      // Color by status
      let color = 0x334155; // no vehicle
      let borderColor = 0x475569;

      if (agent.hasSellOrder) {
        color = 0xf59e0b;   // amber: for sale
        borderColor = 0xfbbf24;
      } else if (agent.vehicleId) {
        color = 0x10b981;   // green: has vehicle
        borderColor = 0x34d399;
      }

      // Retirement warning
      if (agent.ageMonths > 780) {
        borderColor = 0xef4444;
      }

      g.roundRect(0, 0, CELL, CELL, 4);
      g.fill(color);
      g.stroke({ color: borderColor, width: 1.5 });

      // Age indicator - tiny dot at bottom if older
      if (agent.ageMonths > 400) {
        g.circle(CELL / 2, CELL - 4, 2);
        g.fill(0xfbbf24);
      }

      g.x = x;
      g.y = y;
      worldContainer.addChild(g);
    });

    // Legend
    const legendY = agentPanelY + agentPanelH - 28;
    const legendItems: [number, string][] = [
      [0x334155, 'No Vehicle'],
      [0x10b981, 'Has Vehicle'],
      [0xf59e0b, 'Selling'],
    ];
    legendItems.forEach(([color, label], i) => {
      const lx = agentPanelX + 8 + i * 130;
      const g = new Graphics();
      g.roundRect(lx, legendY, 14, 14, 2);
      g.fill(color);
      g.x = 0;
      g.y = 0;
      worldContainer.addChild(g);

      const style = new TextStyle({ fontSize: 10, fill: 0x94a3b8 });
      const t = new Text({ text: label, style });
      t.x = lx + 18;
      t.y = legendY + 1;
      worldContainer.addChild(t);
    });

    const helpStyle = new TextStyle({ fontSize: 11, fill: 0x64748b });
    const help = new Text({ text: 'Drag: pan | Wheel: zoom', style: helpStyle });
    help.x = agentPanelX + panelW - 170;
    help.y = agentPanelY + agentPanelH - 20;
    worldContainer.addChild(help);

    const vmTitleStyle = new TextStyle({ fontSize: 14, fill: 0x94a3b8, fontWeight: '700' });
    const vmTitle = new Text({ text: 'vehicle market', style: vmTitleStyle });
    vmTitle.x = agentPanelX + 14;
    vmTitle.y = vehiclePanelY + 12;
    worldContainer.addChild(vmTitle);

    const sideTitleStyle = new TextStyle({ fontSize: 14, fill: 0x94a3b8, fontWeight: '700' });
    const oemTitle = new Text({ text: 'OEM', style: sideTitleStyle });
    oemTitle.x = 14;
    oemTitle.y = vehiclePanelY + 12;
    worldContainer.addChild(oemTitle);

    const recyclerTitle = new Text({ text: 'recycler', style: sideTitleStyle });
    recyclerTitle.x = recyclerX + 14;
    recyclerTitle.y = vehiclePanelY + 12;
    worldContainer.addChild(recyclerTitle);

    if (!hasUserAdjustedView) resetView();
  }

  $: if (state && worldContainer) drawGrid();
</script>

<div class="market-view" bind:this={hostEl}>
  <canvas bind:this={canvasEl}></canvas>
</div>

<style>
  .market-view {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background: radial-gradient(circle at 20% 20%, #111827 0%, #020617 58%, #000 100%);
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    cursor: grab;
  }
  canvas:active { cursor: grabbing; }
</style>
