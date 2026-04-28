// =====================================================
// Domain Types
// =====================================================

export type VehicleStatus = 'in_use' | 'for_sale' | 'disposed';

export interface Vehicle {
  id: string;
  ageMonths: number;
  lifespanMonths: number;   // 180
  basePrice: number;        // 180
  status: VehicleStatus;
  ownerId: string | null;   // null if disposed
}

export type AgentType = 'individual' | 'manufacturer' | 'recycler';

export interface IndividualAgent {
  type: 'individual';
  id: string;
  ageMonths: number;
  funds: number;
  vehicleId: string | null;
  ownershipStartMonth: number | null; // month when vehicle was acquired
  plannedUsageMonths: number;         // 36-84
  hasSellOrder: boolean;              // currently waiting for sale
}

export interface ManufacturerAgent {
  type: 'manufacturer';
  id: string;
  funds: number;
}

export interface RecyclerAgent {
  type: 'recycler';
  id: string;
  funds: number;
}

export type Agent = IndividualAgent | ManufacturerAgent | RecyclerAgent;

// =====================================================
// Orders
// =====================================================
export interface SellOrder {
  vehicleId: string;
  sellerId: string;
  listedMonth: number;
}

// =====================================================
// Events
// =====================================================
export type EventType =
  | 'AGENT_BORN'
  | 'AGENT_EXITED'
  | 'NEED_DETECTED'
  | 'NEW_CAR_ORDERED'
  | 'NEW_CAR_DELIVERED'
  | 'USED_SELL_ORDER_PLACED'
  | 'USED_BUY_ORDER_PLACED'
  | 'USED_TRADE_EXECUTED'
  | 'VEHICLE_DISPOSED_EOL'
  | 'OWNER_EXIT_DISPOSAL';

export interface SimEvent {
  month: number;
  eventType: EventType;
  agentId?: string;
  sellerId?: string;
  buyerId?: string;
  vehicleId?: string;
  price?: number;
  memo?: string;
}

// =====================================================
// Metrics (per month snapshot)
// =====================================================
export interface MonthlyMetrics {
  month: number;
  agentCount: number;
  vehiclesInUse: number;
  vehiclesForSale: number;
  vehiclesDisposed: number;
  newCarSales: number;
  usedCarSales: number;
  avgUsedPrice: number | null;   // null if no used trades
  totalFundsIndividuals: number;
}

// =====================================================
// Simulation state (serialisable for Comlink transfer)
// =====================================================
export interface SimState {
  month: number;
  agents: Agent[];
  vehicles: Vehicle[];
  sellOrders: SellOrder[];
  events: SimEvent[];         // events emitted this month
  allEvents: SimEvent[];      // cumulative event log
  metrics: MonthlyMetrics[];
}

// =====================================================
// Parameters (tunable via UI)
// =====================================================
export interface SimParams {
  seed: number;
  initialAgents: number;        // 100
  initialFunds: number;         // 1000
  baseVehiclePrice: number;     // 180
  vehicleLifespanMonths: number;// 180
  needProbability: number;      // 0.05
  sellProbability: number;      // 0.03
  newCarRatio: number;          // 0.5  (0-1)
  minUsageMonths: number;       // 36
  maxUsageMonths: number;       // 84
  birthStrategy: 'none' | 'periodic';
  birthIntervalMonths: number;  // 3
  retireAgeMonths: number;      // 840
  driveAgeMonths: number;       // 216
}

export const DEFAULT_PARAMS: SimParams = {
  seed: 42,
  initialAgents: 100,
  initialFunds: 1000,
  baseVehiclePrice: 180,
  vehicleLifespanMonths: 180,
  needProbability: 0.05,
  sellProbability: 0.03,
  newCarRatio: 0.5,
  minUsageMonths: 36,
  maxUsageMonths: 84,
  birthStrategy: 'periodic',
  birthIntervalMonths: 3,
  retireAgeMonths: 840,
  driveAgeMonths: 216,
};
