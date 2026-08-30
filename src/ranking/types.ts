export const RANKING_STORAGE_KEY = "maxgate.ranking.v1";
export const CLIENT_VERSION = "0.1.0";

export interface PlayerProfile {
  playerId: string;
  nickname?: string;
}

export interface RunRecord {
  id: string;
  playerId: string;
  score: number;
  doorsPassed: number;
  maxStage: number;
  seed: string;
  endedAt: number;
  clientVersion: string;
}

export interface RankingStoreV1 {
  version: 1;
  playerId: string;
  nickname?: string;
  records: RunRecord[];
}

export interface RankingAdapter {
  getPlayer(): Promise<PlayerProfile>;
  list(): Promise<RunRecord[]>;
  submit(
    record: Omit<RunRecord, "id" | "playerId"> & { id?: string },
  ): Promise<RunRecord>;
}

export function sortRecords(records: RunRecord[]): RunRecord[] {
  return [...records].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.doorsPassed !== a.doorsPassed) return b.doorsPassed - a.doorsPassed;
    return b.endedAt - a.endedAt;
  });
}
