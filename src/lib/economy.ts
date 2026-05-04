import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { calculateMaxPopulation, calculateWorkerCap } from "@/lib/location-population";

const ECONOMY_TICK_SECONDS = 5;
const DAY_SECONDS = 86_400;
const POPULATION_BASE_ASSIGNMENT = 30;
export const PLAYER_POWER_CAP = 130;
export const PLAYER_MONEY_CAP = 250;

type EconomyRates = {
  moneyRate: number;
  powerRate: number;
  populationRate: number;
  claimPopulationLossPercent: number;
  claimPopulationMin: number;
  productionTimeoutHours: number;
};

function sanitizeWorkers(totalPopulation: number, workers: { money: number; power: number; population: number }) {
  const cap = calculateWorkerCap(totalPopulation);
  let money = Math.max(0, Math.floor(workers.money));
  let power = Math.max(0, Math.floor(workers.power));
  let population = Math.max(0, Math.floor(workers.population));

  const used = money + power + population;
  if (used <= cap) {
    return { money, power, population };
  }

  if (used === 0) {
    return { money: 0, power: 0, population: 0 };
  }

  const ratio = cap / used;
  money = Math.floor(money * ratio);
  power = Math.floor(power * ratio);
  population = Math.floor(population * ratio);

  let remainder = cap - (money + power + population);
  const order: Array<"population" | "money" | "power"> = ["population", "money", "power"];
  while (remainder > 0) {
    for (const key of order) {
      if (remainder <= 0) {
        break;
      }
      if (key === "population") {
        population += 1;
      } else if (key === "money") {
        money += 1;
      } else {
        power += 1;
      }
      remainder -= 1;
    }
  }

  return { money, power, population };
}

export async function getEconomyRates(): Promise<EconomyRates> {
  return db.adminSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      passwordHash: hashPassword("admin"),
      moneyRate: 0.5,
      powerRate: 0.5,
      populationRate: 1,
      claimPopulationLossPercent: 25,
      claimPopulationMin: 3,
      productionTimeoutHours: 24,
    },
    select: {
      moneyRate: true,
      powerRate: true,
      populationRate: true,
      claimPopulationLossPercent: true,
      claimPopulationMin: true,
      productionTimeoutHours: true,
    },
  });
}

let lastTickAt = 0;

export async function runEconomyTick(now = new Date()) {
  if (now.getTime() - lastTickAt < ECONOMY_TICK_SECONDS * 1000) return;
  lastTickAt = now.getTime();

  const rates = await getEconomyRates();
  const timeoutMs = Math.max(0, rates.productionTimeoutHours) * 60 * 60 * 1000;
  const tickThreshold = new Date(now.getTime() - ECONOMY_TICK_SECONDS * 1000);
  const workerTimeoutThreshold = timeoutMs > 0 ? new Date(now.getTime() - timeoutMs) : null;

  const locations = await db.location.findMany({
    where: {
      ownerTeamId: { not: null },
      OR: [
        { economyUpdatedAt: { lte: tickThreshold } },
        ...(workerTimeoutThreshold ? [{ workersUpdatedAt: { lte: workerTimeoutThreshold } }] : []),
      ],
    },
    select: {
      id: true,
      ownerTeamId: true,
      area: true,
      currentPopulation: true,
      popToMoney: true,
      popToPower: true,
      popToPopulation: true,
      workersUpdatedAt: true,
      economyUpdatedAt: true,
      claims: {
        select: {
          userId: true,
          teamId: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
  });

  const locationIds = locations.map((location) => location.id);
  const builtEffects = locationIds.length
    ? await db.builtBuilding.findMany({
        where: {
          locationId: { in: locationIds },
        },
        select: {
          locationId: true,
          buildingDef: {
            select: {
              effectMny: true,
              effectPow: true,
              effectGpop: true,
              effectMaxpop: true,
            },
          },
        },
      })
    : [];

  const effectsByLocation = new Map<number, { mny: number; pow: number; gpop: number; maxpop: number }>();
  for (const row of builtEffects) {
    const current = effectsByLocation.get(row.locationId) ?? { mny: 0, pow: 0, gpop: 0, maxpop: 0 };
    current.mny += row.buildingDef.effectMny;
    current.pow += row.buildingDef.effectPow;
    current.gpop += row.buildingDef.effectGpop;
    current.maxpop += row.buildingDef.effectMaxpop;
    effectsByLocation.set(row.locationId, current);
  }

  // --- Phase 1: compute what needs updating (pure CPU, no DB) ---

  type LocationTimeout = { id: number };
  type UserDelta = { userId: number; moneyDelta: number; powerDelta: number; populationDelta: number };
  type LocationUpdate = {
    id: number;
    nextPopulation: number;
    workers: { money: number; power: number; population: number };
  };

  const timedOutLocations: LocationTimeout[] = [];
  const locationUpdates: LocationUpdate[] = [];
  // accumulate deltas per user (a player can own multiple locations)
  const userDeltaMap = new Map<number, UserDelta>();

  for (const location of locations) {
    const latestClaim = location.claims[0];
    const ownerUserId =
      latestClaim && location.ownerTeamId !== null && latestClaim.teamId === location.ownerTeamId
        ? latestClaim.userId
        : null;
    if (!ownerUserId) continue;

    const assignedWorkers = location.popToMoney + location.popToPower + location.popToPopulation;
    if (assignedWorkers > 0 && timeoutMs > 0) {
      const inactiveMs = now.getTime() - location.workersUpdatedAt.getTime();
      if (inactiveMs >= timeoutMs) {
        timedOutLocations.push({ id: location.id });
        continue;
      }
    }

    const elapsedSeconds = (now.getTime() - location.economyUpdatedAt.getTime()) / 1000;
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < ECONOMY_TICK_SECONDS) continue;

    const elapsedDays = elapsedSeconds / DAY_SECONDS;
    const workers = sanitizeWorkers(location.currentPopulation, {
      money: location.popToMoney,
      power: location.popToPower,
      population: location.popToPopulation,
    });

    const locationEffects = effectsByLocation.get(location.id) ?? { mny: 0, pow: 0, gpop: 0, maxpop: 0 };
    const effectiveMoneyRate = rates.moneyRate + locationEffects.mny;
    const effectivePowerRate = rates.powerRate + locationEffects.pow;
    const effectivePopulationRate = rates.populationRate + locationEffects.gpop;

    const moneyDelta = workers.money * effectiveMoneyRate * elapsedDays;
    const powerDelta = workers.power * effectivePowerRate * elapsedDays;

    const currentPopulation = Math.max(0, location.currentPopulation);
    const baseMaxPopulation = calculateMaxPopulation(location.area) + locationEffects.maxpop;
    const effectiveMaxPopulation = Math.max(baseMaxPopulation, currentPopulation + 1);
    const growthFactor = workers.population / POPULATION_BASE_ASSIGNMENT;
    const carryingFactor = Math.max(0, 1 - currentPopulation / Math.max(1, effectiveMaxPopulation));
    const dPopulation =
      effectivePopulationRate * growthFactor * currentPopulation * carryingFactor * elapsedDays;
    const nextPopulation = Math.max(0, currentPopulation + dPopulation);
    const populationDelta = Math.max(0, nextPopulation - currentPopulation);

    locationUpdates.push({ id: location.id, nextPopulation, workers });

    const existing = userDeltaMap.get(ownerUserId);
    if (existing) {
      existing.moneyDelta += moneyDelta;
      existing.powerDelta += powerDelta;
      existing.populationDelta += populationDelta;
    } else {
      userDeltaMap.set(ownerUserId, { userId: ownerUserId, moneyDelta, powerDelta, populationDelta });
    }
  }

  if (timedOutLocations.length === 0 && locationUpdates.length === 0) return;

  // --- Phase 2: fetch current user balances for cap check (single query) ---

  const userIds = [...userDeltaMap.keys()];
  const userBalances =
    userIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, money: true, power: true },
        })
      : [];
  const userBalanceMap = new Map(userBalances.map((u) => [u.id, u]));

  // --- Phase 3: batch array transaction (no interactive callback — safe inside after()) ---

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ops: any[] = [];

  for (const loc of timedOutLocations) {
    ops.push(
      db.location.update({
        where: { id: loc.id },
        data: { popToMoney: 0, popToPower: 0, popToPopulation: 0, workersAutoStoppedAt: now, economyUpdatedAt: now },
        select: { id: true },
      }),
    );
  }

  for (const loc of locationUpdates) {
    ops.push(
      db.location.update({
        where: { id: loc.id },
        data: {
          currentPopulation: loc.nextPopulation,
          popToMoney: loc.workers.money,
          popToPower: loc.workers.power,
          popToPopulation: loc.workers.population,
          economyUpdatedAt: now,
        },
        select: { id: true },
      }),
    );
  }

  for (const delta of userDeltaMap.values()) {
    const balance = userBalanceMap.get(delta.userId);
    if (!balance) continue;

    const moneyIncrement =
      delta.moneyDelta > 0
        ? Math.min(delta.moneyDelta, Math.max(0, PLAYER_MONEY_CAP - balance.money))
        : delta.moneyDelta;
    const powerIncrement =
      delta.powerDelta > 0
        ? Math.min(delta.powerDelta, Math.max(0, PLAYER_POWER_CAP - balance.power))
        : delta.powerDelta;

    ops.push(
      db.user.update({
        where: { id: delta.userId },
        data: {
          money: { increment: moneyIncrement },
          power: { increment: powerIncrement },
          population: { increment: delta.populationDelta },
        },
        select: { id: true },
      }),
    );
  }

  if (ops.length > 0) {
    await db.$transaction(ops);
  }
}

export function normalizeWorkerSplit(currentPopulation: number, input: { money: number; power: number; population: number }) {
  return sanitizeWorkers(currentPopulation, input);
}

export const ECONOMY_INTERVAL_MS = ECONOMY_TICK_SECONDS * 1000;
