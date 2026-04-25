import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { calculateWorkerCap, deriveLocationPopulation, roundDownPopulation } from "@/lib/location-population";

const ECONOMY_TICK_SECONDS = 5;
const DAY_SECONDS = 86_400;
const POPULATION_BASE_ASSIGNMENT = 30;

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

export async function runEconomyTick(now = new Date()) {
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

  for (const location of locations) {
    const latestClaim = location.claims[0];
    const ownerUserId =
      latestClaim && location.ownerTeamId !== null && latestClaim.teamId === location.ownerTeamId
        ? latestClaim.userId
        : null;
    if (!ownerUserId) {
      continue;
    }

    const assignedWorkers = location.popToMoney + location.popToPower + location.popToPopulation;
    if (assignedWorkers > 0 && timeoutMs > 0) {
      const inactiveMs = now.getTime() - location.workersUpdatedAt.getTime();
      if (inactiveMs >= timeoutMs) {
        await db.location.update({
          where: { id: location.id },
          data: {
            popToMoney: 0,
            popToPower: 0,
            popToPopulation: 0,
            workersAutoStoppedAt: now,
            economyUpdatedAt: now,
          },
        });
        continue;
      }
    }

    const elapsedSeconds = (now.getTime() - location.economyUpdatedAt.getTime()) / 1000;
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < ECONOMY_TICK_SECONDS) {
      continue;
    }

    const elapsedDays = elapsedSeconds / DAY_SECONDS;
    const { minPopulation, maxPopulation } = deriveLocationPopulation(location.area, location.currentPopulation);
    const workers = sanitizeWorkers(location.currentPopulation, {
      money: location.popToMoney,
      power: location.popToPower,
      population: location.popToPopulation,
    });

    const locationEffects = effectsByLocation.get(location.id) ?? { mny: 0, pow: 0, gpop: 0, maxpop: 0 };
    const buildingMny = locationEffects.mny;
    const buildingPow = locationEffects.pow;
    const buildingGpop = locationEffects.gpop;
    const buildingMaxpop = locationEffects.maxpop;

    const effectiveMoneyRate = rates.moneyRate + buildingMny;
    const effectivePowerRate = rates.powerRate + buildingPow;
    const effectivePopulationRate = rates.populationRate + buildingGpop;

    const moneyDelta = workers.money * effectiveMoneyRate * elapsedDays;
    const powerDelta = workers.power * effectivePowerRate * elapsedDays;

    const effectiveMaxPopulation = maxPopulation + buildingMaxpop;
    const currentPopulation = Math.max(minPopulation, Math.min(effectiveMaxPopulation, location.currentPopulation));
    const growthFactor = workers.population / POPULATION_BASE_ASSIGNMENT;
    const dPopulation =
      effectivePopulationRate * growthFactor * currentPopulation * (1 - currentPopulation / effectiveMaxPopulation) * elapsedDays;
    const nextPopulation = Math.max(
      minPopulation,
      Math.min(effectiveMaxPopulation, roundDownPopulation(currentPopulation + dPopulation)),
    );
    const populationDelta = Math.max(0, nextPopulation - currentPopulation);

    await db.$transaction(async (tx) => {
      await tx.location.update({
        where: { id: location.id },
        data: {
          currentPopulation: nextPopulation,
          popToMoney: workers.money,
          popToPower: workers.power,
          popToPopulation: workers.population,
          economyUpdatedAt: now,
        },
      });

      await tx.user.update({
        where: { id: ownerUserId },
        data: {
          money: { increment: moneyDelta },
          power: { increment: powerDelta },
          population: { increment: populationDelta },
        },
      });
    });
  }
}

export function normalizeWorkerSplit(currentPopulation: number, input: { money: number; power: number; population: number }) {
  return sanitizeWorkers(currentPopulation, input);
}

export const ECONOMY_INTERVAL_MS = ECONOMY_TICK_SECONDS * 1000;
