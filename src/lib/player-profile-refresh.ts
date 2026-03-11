import type { Firestore } from "firebase-admin/firestore";

export type PlayerProfileRefreshTarget = {
  shortId?: string;
  name?: string;
};

type PlayerIdentitySource = {
  shortId?: unknown;
  name?: unknown;
};

const normalizeString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

export function buildPlayerProfileRefreshTargets(players: PlayerIdentitySource[]): PlayerProfileRefreshTarget[] {
  const seen = new Set<string>();
  const targets: PlayerProfileRefreshTarget[] = [];

  for (const player of players) {
    const shortId = normalizeString(player.shortId);
    const name = normalizeString(player.name);
    const key = shortId ? `sid:${shortId}` : name ? `name:${name}` : "";
    if (!key || seen.has(key)) continue;
    seen.add(key);
    targets.push(shortId ? { shortId, name } : { name });
  }

  return targets;
}

export async function readEventParticipantProfileRefreshTargets(
  db: Firestore,
  tournamentId: string,
  divisionId: string,
  eventId: string,
): Promise<PlayerProfileRefreshTarget[]> {
  const participantsSnap = await db
    .collection("tournaments").doc(tournamentId)
    .collection("divisions").doc(divisionId)
    .collection("events").doc(eventId)
    .collection("participants")
    .get();

  if (participantsSnap.empty) {
    return [];
  }

  const playerRefs = participantsSnap.docs
    .map((doc) => String(doc.data()?.playerId ?? doc.id))
    .filter(Boolean)
    .map((playerId) => db.collection("tournaments").doc(tournamentId).collection("players").doc(playerId));

  const playerDocs = await Promise.all(playerRefs.map((ref) => ref.get()));
  const playerIdentityRows = playerDocs
    .filter((doc) => doc.exists)
    .map((doc) => doc.data() ?? {});

  return buildPlayerProfileRefreshTargets(playerIdentityRows);
}
