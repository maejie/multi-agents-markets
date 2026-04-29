<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Application, Graphics, Text, TextStyle, Container } from 'pixi.js';
  import type { Ticker } from 'pixi.js';
  import type { SimState, SimEvent } from '../simulation/types';

  export let state: SimState | null = null;

  let hostEl: HTMLDivElement;
  let canvasEl: HTMLCanvasElement;
  let app: Application;
  let worldContainer: Container;
  let resizeObserver: ResizeObserver;

  // ── Animation system ──────────────────────────────────
  let animationLayer: Container | null = null;
  let animatedEventCount = 0;

  interface LayoutInfo {
    oemCenter: { x: number; y: number };
    recyclerCenter: { x: number; y: number };
    vehicleMarketCenter: { x: number; y: number };
    agentPanelCenter: { x: number; y: number };
    agentPositions: Map<string, { x: number; y: number }>;
  }
  let layoutInfo: LayoutInfo | null = null;

  interface Particle {
    gfx: Graphics;
    pathPoints: Array<{ x: number; y: number }>;
    elapsed: number;
    totalDuration: number;
  }
  const MAX_PARTICLES = 30;
  const PARTICLE_TOTAL_MS = 450;
  const FADE_START = 0.8;    // particle starts fading at 80% of animation
  const FADE_DURATION = 0.2; // fade lasts the remaining 20%
  let particles: Particle[] = [];

  function onTick(ticker: Ticker) {
    const dt = ticker.deltaMS;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.elapsed += dt;
      const t = Math.min(p.elapsed / p.totalDuration, 1);

      const totalSegments = p.pathPoints.length - 1;
      const globalT = t * totalSegments;
      const segIdx = Math.min(Math.floor(globalT), totalSegments - 1);
      const segT = globalT - segIdx;
      const from = p.pathPoints[segIdx];
      const to = p.pathPoints[segIdx + 1];
      const x = from.x + (to.x - from.x) * segT;
      const y = from.y + (to.y - from.y) * segT;

      const alpha = t > FADE_START ? (1 - t) / FADE_DURATION : 1;

      p.gfx.clear();
      // Outer glow
      p.gfx.circle(x, y, 11);
      p.gfx.fill({ color: 0x1d4ed8, alpha: 0.18 * alpha });
      // Mid glow
      p.gfx.circle(x, y, 7);
      p.gfx.fill({ color: 0x3b82f6, alpha: 0.45 * alpha });
      // Inner ring
      p.gfx.circle(x, y, 4);
      p.gfx.fill({ color: 0x93c5fd, alpha: 0.8 * alpha });
      // Bright core
      p.gfx.circle(x, y, 2);
      p.gfx.fill({ color: 0xffffff, alpha: alpha });

      if (t >= 1) {
        animationLayer?.removeChild(p.gfx);
        p.gfx.destroy();
        particles.splice(i, 1);
      }
    }
  }

  function spawnParticle(pathPoints: Array<{ x: number; y: number }>) {
    if (!animationLayer || pathPoints.length < 2 || particles.length >= MAX_PARTICLES) return;
    const gfx = new Graphics();
    animationLayer.addChild(gfx);
    particles.push({ gfx, pathPoints, elapsed: 0, totalDuration: PARTICLE_TOTAL_MS });
  }

  function spawnParticlesForEvents(events: SimEvent[]) {
    if (!layoutInfo) return;
    const { oemCenter, recyclerCenter, vehicleMarketCenter, agentPanelCenter, agentPositions } = layoutInfo;
    const vmY = vehicleMarketCenter.y;

    for (const ev of events) {
      if (ev.eventType === 'NEW_CAR_DELIVERED') {
        const agentPos = ev.agentId ? (agentPositions.get(ev.agentId) ?? agentPanelCenter) : agentPanelCenter;
        spawnParticle([
          oemCenter,
          { x: oemCenter.x, y: vmY },
          { x: agentPos.x, y: vmY },
          agentPos,
        ]);
      } else if (ev.eventType === 'USED_TRADE_EXECUTED') {
        const sellerPos = ev.sellerId ? (agentPositions.get(ev.sellerId) ?? agentPanelCenter) : agentPanelCenter;
        const buyerPos = ev.buyerId ? (agentPositions.get(ev.buyerId) ?? agentPanelCenter) : agentPanelCenter;
        spawnParticle([
          sellerPos,
          { x: sellerPos.x, y: vmY },
          { x: buyerPos.x, y: vmY },
          buyerPos,
        ]);
      } else if (ev.eventType === 'VEHICLE_DISPOSED_EOL' || ev.eventType === 'OWNER_EXIT_DISPOSAL') {
        const agentPos = ev.agentId ? (agentPositions.get(ev.agentId) ?? agentPanelCenter) : agentPanelCenter;
        spawnParticle([
          agentPos,
          { x: agentPos.x, y: vmY },
          { x: recyclerCenter.x, y: vmY },
          recyclerCenter,
        ]);
      }
    }
  }
  // ─────────────────────────────────────────────────────

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

    app.ticker.add(onTick);

    drawGrid();
    resetView();
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    hostEl?.removeEventListener('wheel', onWheel);
    hostEl?.removeEventListener('mousedown', onPanStart);
    window.removeEventListener('mousemove', onPanMove);
    window.removeEventListener('mouseup', onPanEnd);
    app?.ticker.remove(onTick);
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
    // Detach animation layer before clearing so particles persist
    if (animationLayer && animationLayer.parent) {
      animationLayer.parent.removeChild(animationLayer);
    }
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

    // Build agent position map for animation
    const agentPositions = new Map<string, { x: number; y: number }>();
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

      // Blue light inside agents that own a vehicle
      if (agent.vehicleId) {
        const cx = CELL / 2;
        const cy = CELL / 2;
        g.circle(cx, cy, 7);
        g.fill({ color: 0x1d4ed8, alpha: 0.3 });
        g.circle(cx, cy, 4.5);
        g.fill({ color: 0x3b82f6, alpha: 0.6 });
        g.circle(cx, cy, 2.5);
        g.fill({ color: 0x93c5fd, alpha: 0.9 });
        g.circle(cx, cy, 1.2);
        g.fill({ color: 0xffffff, alpha: 1 });
      }

      // Age indicator - tiny dot at bottom if older
      if (agent.ageMonths > 400) {
        g.circle(CELL / 2, CELL - 4, 2);
        g.fill(0xfbbf24);
      }

      g.x = x;
      g.y = y;
      worldContainer.addChild(g);

      agentPositions.set(agent.id, { x: x + CELL / 2, y: y + CELL / 2 });
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

    // Store layout for animation
    layoutInfo = {
      oemCenter: { x: SIDE_CONTAINER_WIDTH / 2, y: vehiclePanelY + SIDE_CONTAINER_HEIGHT / 2 },
      recyclerCenter: { x: recyclerX + SIDE_CONTAINER_WIDTH / 2, y: vehiclePanelY + SIDE_CONTAINER_HEIGHT / 2 },
      vehicleMarketCenter: { x: agentPanelX + panelW / 2, y: vehiclePanelY + VEHICLE_MARKET_HEIGHT / 2 },
      agentPanelCenter: { x: agentPanelX + panelW / 2, y: agentPanelY + agentPanelH / 2 },
      agentPositions,
    };

    // Spawn particles for events new since last draw
    if (state.allEvents.length < animatedEventCount) {
      // Simulation was reset
      animatedEventCount = 0;
    }
    if (state.allEvents.length > animatedEventCount) {
      const newEvents = state.allEvents.slice(animatedEventCount);
      animatedEventCount = state.allEvents.length;
      spawnParticlesForEvents(newEvents);
    }

    // Re-attach animation layer on top of grid
    if (!animationLayer) animationLayer = new Container();
    worldContainer.addChild(animationLayer);

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
