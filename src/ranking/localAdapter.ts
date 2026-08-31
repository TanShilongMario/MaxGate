import {
  RANKING_STORAGE_KEY,
  sortRecords,
  type RankingAdapter,
  type RankingStoreV1,
  type RunRecord,
} from "./types";

const MAX_RECORDS = 50;
const DIFFICULTIES = ["cozy", "classic", "rush"] as const;

function emptyStore(): RankingStoreV1 {
  return {
    version: 1,
    playerId: crypto.randomUUID(),
    records: [],
  };
}

function readStore(): RankingStoreV1 {
  try {
    const raw = localStorage.getItem(RANKING_STORAGE_KEY);
    if (!raw) {
      const created = emptyStore();
      writeStore(created);
      return created;
    }
    const parsed = JSON.parse(raw) as RankingStoreV1;
    if (parsed.version !== 1 || !parsed.playerId || !Array.isArray(parsed.records)) {
      const created = emptyStore();
      writeStore(created);
      return created;
    }
    return {
      ...parsed,
      records: parsed.records.map((record) => ({
        ...record,
        difficulty: DIFFICULTIES.includes(record.difficulty) ? record.difficulty : "classic",
      })),
    };
  } catch {
    const created = emptyStore();
    writeStore(created);
    return created;
  }
}

function writeStore(store: RankingStoreV1): void {
  localStorage.setItem(RANKING_STORAGE_KEY, JSON.stringify(store));
}

export class LocalRankingAdapter implements RankingAdapter {
  async getPlayer() {
    const store = readStore();
    return store.nickname
      ? { playerId: store.playerId, nickname: store.nickname }
      : { playerId: store.playerId };
  }

  async list() {
    return sortRecords(readStore().records);
  }

  async submit(record: Omit<RunRecord, "id" | "playerId"> & { id?: string }) {
    const store = readStore();
    const saved: RunRecord = {
      ...record,
      id: record.id ?? crypto.randomUUID(),
      playerId: store.playerId,
    };
    const counts = { cozy: 0, classic: 0, rush: 0 };
    store.records = sortRecords([saved, ...store.records]).filter((candidate) => {
      if (counts[candidate.difficulty] >= MAX_RECORDS) return false;
      counts[candidate.difficulty] += 1;
      return true;
    });
    writeStore(store);
    return saved;
  }
}
