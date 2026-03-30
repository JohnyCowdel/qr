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
  const existing = await db.adminSettings.findUnique({
    where: { id: 1 },
    select: {
      moneyRate: true,
      powerRate: true,
      populationRate: true,
    },
  });

  if (existing) {
    return existing;
  }

  const settings = await db.adminSettings.create({
    data: {
      id: 1,
      passwordHash: hashPassword("admin"),
      moneyRate: 0.5,
      powerRate: 0.5,
      populationRate: 1,
    },
    select: {
      moneyRate: true,
      powerRate: true,
      populationRate: true,
    },
  });

  return settings;
}

export async function runEconomyTick(now = new Date()) {
  const rates = await getEconomyRates();

  const locations = await db.location.findMany({
    where: {
      ownerTeamId: { not: null },
    },
    select: {
      id: true,
      area: true,
      currentPopulation: true,
      popToMoney: true,
      popToPower: true,
      popToPopulation: true,
      economyUpdatedAt: true,
      claims: {
        select: {
          userId: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
  });

  for (const location of locations) {
    const ownerUserId = location.claims[0]?.userId;
    if (!ownerUserId) {
      continue;
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

    const moneyDelta = workers.money * rates.moneyRate * elapsedDays;
    const powerDelta = workers.power * rates.powerRate * elapsedDays;

    const currentPopulation = Math.max(minPopulation, Math.min(maxPopulation, location.currentPopulation));
    const growthFactor = workers.population / POPULATION_BASE_ASSIGNMENT;
    const dPopulation = rates.populationRate * growthFactor * currentPopulation * (1 - currentPopulation / maxPopulation) * elapsedDays;
    const nextPopulation = Math.max(
      minPopulation,
      Math.min(maxPopulation, roundDownPopulation(currentPopulation + dPopulation)),
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
