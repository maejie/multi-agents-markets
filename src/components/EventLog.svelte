<script lang="ts">
  import type { SimEvent } from '../simulation/types';

  export let events: SimEvent[] = [];

  const EVENT_ICONS: Record<string, string> = {
    AGENT_BORN: '👶',
    AGENT_EXITED: '💀',
    NEED_DETECTED: '🚗',
    NEW_CAR_ORDERED: '📋',
    NEW_CAR_DELIVERED: '✅',
    USED_SELL_ORDER_PLACED: '🏷️',
    USED_BUY_ORDER_PLACED: '🛒',
    USED_TRADE_EXECUTED: '🤝',
    VEHICLE_DISPOSED_EOL: '♻️',
    OWNER_EXIT_DISPOSAL: '🗑️',
  };

  const EVENT_COLORS: Record<string, string> = {
    AGENT_BORN: '#60a5fa',
    AGENT_EXITED: '#ef4444',
    NEED_DETECTED: '#a78bfa',
    NEW_CAR_ORDERED: '#34d399',
    NEW_CAR_DELIVERED: '#10b981',
    USED_SELL_ORDER_PLACED: '#fbbf24',
    USED_BUY_ORDER_PLACED: '#f59e0b',
    USED_TRADE_EXECUTED: '#22d3ee',
    VEHICLE_DISPOSED_EOL: '#64748b',
    OWNER_EXIT_DISPOSAL: '#475569',
  };

  // Show last 100 events most-recent first
  $: displayEvents = [...events].reverse().slice(0, 100);
</script>

<div class="event-log">
  <div class="log-header">📡 Event Log</div>
  <div class="log-body">
    {#each displayEvents as ev (ev.month + '_' + ev.eventType + '_' + (ev.vehicleId ?? '') + '_' + (ev.agentId ?? ''))}
      <div class="log-row" style="border-left-color: {EVENT_COLORS[ev.eventType] ?? '#334155'}">
        <span class="badge" style="color: {EVENT_COLORS[ev.eventType] ?? '#94a3b8'}">
          {EVENT_ICONS[ev.eventType] ?? '•'}
        </span>
        <span class="month">M{ev.month}</span>
        <span class="type">{ev.eventType}</span>
        {#if ev.price !== undefined}
          <span class="price">¥{ev.price}</span>
        {/if}
        {#if ev.vehicleId}
          <span class="id">{ev.vehicleId}</span>
        {/if}
      </div>
    {/each}
    {#if displayEvents.length === 0}
      <div class="empty">Waiting for events…</div>
    {/if}
  </div>
</div>

<style>
  .event-log {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    height: 400px;
  }
  .log-header {
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 700;
    color: #94a3b8;
    border-bottom: 1px solid #1e293b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .log-body {
    overflow-y: auto;
    flex: 1;
    padding: 4px 0;
  }
  .log-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border-left: 3px solid transparent;
    font-size: 11px;
    transition: background 0.1s;
  }
  .log-row:hover { background: #1e293b; }
  .badge { font-size: 13px; flex-shrink: 0; }
  .month { color: #475569; min-width: 36px; }
  .type { color: #cbd5e1; flex: 1; }
  .price { color: #fbbf24; font-weight: 600; }
  .id { color: #334155; font-size: 9px; }
  .empty { padding: 16px; color: #475569; text-align: center; font-size: 12px; }
</style>
