import seedrandom from 'seedrandom';
import type {
  SimState, SimParams, SimEvent, Vehicle, IndividualAgent,
  SellOrder, MonthlyMetrics, Agent,
} from './types';
import { DEFAULT_PARAMS } from './types';

// =====================================================
// Helpers
// =====================================================
let _rng: seedrandom.PRNG;
function rng(): number { return _rng(); }

let _nextId = 0;
function uid(prefix: string): string { return `${prefix}_${++_nextId}`; }

function randInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function calcUsedPrice(basePrice: number, vehicleAgeMonths: number): number {
  return Math.max(1, basePrice - vehicleAgeMonths);
}

// =====================================================
// Initialise state
// =====================================================
export function createInitialState(params: SimParams = DEFAULT_PARAMS): SimState {
  _rng = seedrandom(String(params.seed));
  _nextId = 0;

  const manufacturer: Agent = { type: 'manufacturer', id: 'manufacturer_0', funds: params.initialFunds };
  const recycler: Agent = { type: 'recycler', id: 'recycler_0', funds: params.initialFunds };

  const individuals: IndividualAgent[] = Array.from({ length: params.initialAgents }, () => {
    const ageMonths = randInt(12, 720);
    return {
      type: 'individual',
      id: uid('agent'),
      ageMonths,
      funds: params.initialFunds,
      vehicleId: null,
      ownershipStartMonth: null,
      plannedUsageMonths: randInt(params.minUsageMonths, params.maxUsageMonths),
      hasSellOrder: false,
    };
  });

  return {
    month: 0,
    agents: [manufacturer, recycler, ...individuals],
    vehicles: [],
    sellOrders: [],
    events: [],
    allEvents: [],
    metrics: [],
  };
}

// =====================================================
// Main step function - advances state by 1 month
// =====================================================
export function stepMonth(state: SimState, params: SimParams): SimState {
  // Deep clone to keep immutability for React/Svelte diffing
  const s = deepClone(state);
  // Restore rng determinism using seed + month as sub-seed
  _rng = seedrandom(`${params.seed}_${s.month + 1}`);

  s.month += 1;
  const emit = (ev: Omit<SimEvent, 'month'>) => {
    const full = { ...ev, month: s.month };
    s.events.push(full);
    s.allEvents.push(full);
  };

  const vMap = new Map<string, Vehicle>(s.vehicles.map(v => [v.id, v]));
  const agentMap = new Map<string, IndividualAgent>();
  for (const a of s.agents) {
    if (a.type === 'individual') agentMap.set(a.id, a);
  }
  const manufacturer = s.agents.find(a => a.type === 'manufacturer')!;
  // const recycler = s.agents.find(a => a.type === 'recycler')!;

  // ─── Step 1: Age all individuals ──────────────────
  for (const a of agentMap.values()) a.ageMonths += 1;

  // ─── Step 2: Birth new individual according to strategy ───
  if (params.birthStrategy === 'periodic' && s.month % params.birthIntervalMonths === 0) {
    const baby: IndividualAgent = {
      type: 'individual',
      id: uid('agent'),
      ageMonths: 0,
      funds: params.initialFunds,
      vehicleId: null,
      ownershipStartMonth: null,
      plannedUsageMonths: randInt(params.minUsageMonths, params.maxUsageMonths),
      hasSellOrder: false,
    };
    s.agents.push(baby);
    agentMap.set(baby.id, baby);
    emit({ eventType: 'AGENT_BORN', agentId: baby.id });
  }

  // ─── Step 3: Age all active vehicles ──────────────
  for (const v of vMap.values()) {
    if (v.status !== 'disposed') v.ageMonths += 1;
  }

  // ─── Step 4: Dispose end-of-life vehicles ─────────
  const eolVehicleIds: string[] = [];
  for (const v of vMap.values()) {
    if (v.status !== 'disposed' && v.ageMonths >= params.vehicleLifespanMonths) {
      eolVehicleIds.push(v.id);
    }
  }
  for (const vid of eolVehicleIds) {
    disposeVehicle(vid, 'VEHICLE_DISPOSED_EOL', s, vMap, agentMap, emit);
  }

  // ─── Step 5: Retire agents aged >= retireAgeMonths ─
  const retirees = [...agentMap.values()].filter(a => a.ageMonths >= params.retireAgeMonths);
  for (const a of retirees) {
    if (a.vehicleId) {
      disposeVehicle(a.vehicleId, 'OWNER_EXIT_DISPOSAL', s, vMap, agentMap, emit);
    }
    emit({ eventType: 'AGENT_EXITED', agentId: a.id });
    agentMap.delete(a.id);
    s.agents = s.agents.filter(x => x.id !== a.id);
  }

  // ─── Step 6: Demand detection ─────────────────────
  const needsVehicle: IndividualAgent[] = [];
  for (const a of agentMap.values()) {
    if (a.vehicleId === null && !a.hasSellOrder && a.ageMonths > params.driveAgeMonths) {
      if (rng() < params.needProbability) {
        needsVehicle.push(a);
        emit({ eventType: 'NEED_DETECTED', agentId: a.id });
      }
    }
  }

  // ─── Step 7: Sell intent detection ────────────────
  const wantToSell: IndividualAgent[] = [];
  for (const a of agentMap.values()) {
    if (a.vehicleId && !a.hasSellOrder && a.ownershipStartMonth !== null) {
      const held = s.month - a.ownershipStartMonth;
      const forced = held >= params.maxUsageMonths;
      if (forced || (held >= params.minUsageMonths && rng() < params.sellProbability)) {
        wantToSell.push(a);
      }
    }
  }

  // ─── Step 8: Register sell orders ─────────────────
  for (const a of wantToSell) {
    if (!a.vehicleId) continue;
    const existingOrder = s.sellOrders.find(o => o.vehicleId === a.vehicleId);
    if (existingOrder) continue;
    a.hasSellOrder = true;
    s.sellOrders.push({ vehicleId: a.vehicleId, sellerId: a.id, listedMonth: s.month });
    emit({ eventType: 'USED_SELL_ORDER_PLACED', agentId: a.id, vehicleId: a.vehicleId });
  }

  // ─── Step 9: Process buy orders ───────────────────
  // Sort needsVehicle by id ascending (tie-break)
  needsVehicle.sort((a, b) => a.id.localeCompare(b.id));

  const successfulSellers: string[] = []; // sellerIds who completed a sale

  for (const buyer of needsVehicle) {
    const availableSellOrders = s.sellOrders.filter(o => !successfulSellers.includes(o.sellerId));
    const wantsNew = availableSellOrders.length === 0 || rng() < params.newCarRatio;

    if (wantsNew) {
      // New car purchase
      const vehicle: Vehicle = {
        id: uid('vehicle'),
        ageMonths: 0,
        lifespanMonths: params.vehicleLifespanMonths,
        basePrice: params.baseVehiclePrice,
        status: 'in_use',
        ownerId: buyer.id,
      };
      vMap.set(vehicle.id, vehicle);
      s.vehicles.push(vehicle);
      buyer.vehicleId = vehicle.id;
      buyer.ownershipStartMonth = s.month;
      buyer.funds -= params.baseVehiclePrice;
      (manufacturer as any).funds += params.baseVehiclePrice;
      emit({ eventType: 'NEW_CAR_ORDERED', agentId: buyer.id, vehicleId: vehicle.id });
      emit({ eventType: 'NEW_CAR_DELIVERED', agentId: buyer.id, vehicleId: vehicle.id, price: params.baseVehiclePrice });
    } else {
      // Used car purchase - FIFO
      const order = availableSellOrders[0];
      const vehicle = vMap.get(order.vehicleId);
      if (!vehicle) continue;

      const price = calcUsedPrice(vehicle.basePrice, vehicle.ageMonths);
      const seller = agentMap.get(order.sellerId);
      if (!seller) continue;

      emit({ eventType: 'USED_BUY_ORDER_PLACED', agentId: buyer.id, vehicleId: vehicle.id, price });

      // Execute trade
      vehicle.status = 'in_use';
      vehicle.ownerId = buyer.id;
      buyer.vehicleId = vehicle.id;
      buyer.ownershipStartMonth = s.month;
      buyer.funds -= price;
      seller.funds += price;
      seller.vehicleId = null;
      seller.ownershipStartMonth = null;
      seller.hasSellOrder = false;
      s.sellOrders = s.sellOrders.filter(o => o.vehicleId !== vehicle.id);
      successfulSellers.push(seller.id);

      emit({
        eventType: 'USED_TRADE_EXECUTED',
        buyerId: buyer.id,
        sellerId: seller.id,
        vehicleId: vehicle.id,
        price,
      });
    }
  }

  // ─── Step 10 & 11: Sellers who completed a sale buy next vehicle ─
  const resolvedSellers = successfulSellers
    .map(id => agentMap.get(id))
    .filter(Boolean) as IndividualAgent[];

  // sort by id for determinism
  resolvedSellers.sort((a, b) => a.id.localeCompare(b.id));

  for (const seller of resolvedSellers) {
    const availableSellOrdersNow = s.sellOrders;
    const wantsNew = availableSellOrdersNow.length === 0 || rng() < params.newCarRatio;
    if (wantsNew) {
      const vehicle: Vehicle = {
        id: uid('vehicle'),
        ageMonths: 0,
        lifespanMonths: params.vehicleLifespanMonths,
        basePrice: params.baseVehiclePrice,
        status: 'in_use',
        ownerId: seller.id,
      };
      vMap.set(vehicle.id, vehicle);
      s.vehicles.push(vehicle);
      seller.vehicleId = vehicle.id;
      seller.ownershipStartMonth = s.month;
      seller.funds -= params.baseVehiclePrice;
      (manufacturer as any).funds += params.baseVehiclePrice;
      emit({ eventType: 'NEW_CAR_ORDERED', agentId: seller.id, vehicleId: vehicle.id });
      emit({ eventType: 'NEW_CAR_DELIVERED', agentId: seller.id, vehicleId: vehicle.id, price: params.baseVehiclePrice });
    } else {
      const order = availableSellOrdersNow[0];
      const vehicle = vMap.get(order?.vehicleId ?? '');
      if (!vehicle || !order) {
        // fallback to new car
        const nv: Vehicle = {
          id: uid('vehicle'),
          ageMonths: 0,
          lifespanMonths: params.vehicleLifespanMonths,
          basePrice: params.baseVehiclePrice,
          status: 'in_use',
          ownerId: seller.id,
        };
        vMap.set(nv.id, nv);
        s.vehicles.push(nv);
        seller.vehicleId = nv.id;
        seller.ownershipStartMonth = s.month;
        seller.funds -= params.baseVehiclePrice;
        (manufacturer as any).funds += params.baseVehiclePrice;
        emit({ eventType: 'NEW_CAR_ORDERED', agentId: seller.id, vehicleId: nv.id });
        emit({ eventType: 'NEW_CAR_DELIVERED', agentId: seller.id, vehicleId: nv.id, price: params.baseVehiclePrice });
        continue;
      }

      const price = calcUsedPrice(vehicle.basePrice, vehicle.ageMonths);
      const prevSeller = agentMap.get(order.sellerId);
      if (!prevSeller) continue;

      emit({ eventType: 'USED_BUY_ORDER_PLACED', agentId: seller.id, vehicleId: vehicle.id, price });
      vehicle.status = 'in_use';
      vehicle.ownerId = seller.id;
      seller.vehicleId = vehicle.id;
      seller.ownershipStartMonth = s.month;
      seller.funds -= price;
      prevSeller.funds += price;
      prevSeller.vehicleId = null;
      prevSeller.ownershipStartMonth = null;
      prevSeller.hasSellOrder = false;
      s.sellOrders = s.sellOrders.filter(o => o.vehicleId !== vehicle.id);

      emit({
        eventType: 'USED_TRADE_EXECUTED',
        buyerId: seller.id,
        sellerId: prevSeller.id,
        vehicleId: vehicle.id,
        price,
      });
    }
  }

  // ─── Sync vehicle array back ───────────────────────
  s.vehicles = [...vMap.values()];

  // ─── Step 12: Collect monthly metrics ─────────────
  const inUse = s.vehicles.filter(v => v.status === 'in_use').length;
  const forSale = s.vehicles.filter(v => v.status === 'for_sale').length;
  const disposed = s.vehicles.filter(v => v.status === 'disposed').length;
  const usedTrades = s.events.filter(e => e.eventType === 'USED_TRADE_EXECUTED');
  const avgUsedPrice = usedTrades.length
    ? usedTrades.reduce((sum, e) => sum + (e.price ?? 0), 0) / usedTrades.length
    : null;
  const individuals = s.agents.filter(a => a.type === 'individual') as IndividualAgent[];

  const metrics: MonthlyMetrics = {
    month: s.month,
    agentCount: individuals.length,
    vehiclesInUse: inUse,
    vehiclesForSale: forSale,
    vehiclesDisposed: disposed,
    newCarSales: s.events.filter(e => e.eventType === 'NEW_CAR_DELIVERED').length,
    usedCarSales: usedTrades.length,
    avgUsedPrice,
    totalFundsIndividuals: individuals.reduce((sum, a) => sum + a.funds, 0),
  };
  s.metrics.push(metrics);

  // Reset month events accumulation for next step (keep allEvents)
  s.events = [...s.events]; // already accumulated

  return s;
}

// =====================================================
// Helpers
// =====================================================
function disposeVehicle(
  vehicleId: string,
  eventType: 'VEHICLE_DISPOSED_EOL' | 'OWNER_EXIT_DISPOSAL',
  s: SimState,
  vMap: Map<string, Vehicle>,
  agentMap: Map<string, IndividualAgent>,
  emit: (ev: Omit<SimEvent, 'month'>) => void
): void {
  const vehicle = vMap.get(vehicleId);
  if (!vehicle || vehicle.status === 'disposed') return;

  // Remove sell order if exists
  s.sellOrders = s.sellOrders.filter(o => o.vehicleId !== vehicleId);

  const prevOwner = vehicle.ownerId ? agentMap.get(vehicle.ownerId) : null;
  if (prevOwner) {
    prevOwner.vehicleId = null;
    prevOwner.ownershipStartMonth = null;
    prevOwner.hasSellOrder = false;
  }

  vehicle.status = 'disposed';
  vehicle.ownerId = null;
  emit({ eventType, vehicleId });
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
