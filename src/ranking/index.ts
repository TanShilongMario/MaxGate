export type { RankingAdapter, RunRecord, PlayerProfile } from "./types";
export { CLIENT_VERSION, RANKING_STORAGE_KEY, sortRecords } from "./types";
export { LocalRankingAdapter } from "./localAdapter";

/**
 * 以后接线上榜时：
 *   const adapter = new RemoteRankingAdapter(import.meta.env.VITE_API_BASE)
 * 游戏内只依赖 RankingAdapter，不必改 Game。
 */
