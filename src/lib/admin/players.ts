import type { Firestore } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { findOrCreateGlobalPlayer } from "@/lib/shortId";

export type PlayerInput = {
  divisionId: string;
  group: string;
  region: string;
  affiliation: string;
  name: string;
  hand: "left" | "right";
};

export const normalizePlayerInput = (body: any): Partial<PlayerInput> => ({
  divisionId: typeof body?.divisionId === "string" ? body.divisionId.trim() : "",
  group: typeof body?.group === "string" ? body.group.trim() : "",
  region: typeof body?.region === "string" ? body.region.trim() : "",
  affiliation: typeof body?.affiliation === "string" ? body.affiliation.trim() : "",
  name: typeof body?.name === "string" ? body.name.trim() : "",
  hand: typeof body?.hand === "string" ? body.hand.toLowerCase() : "",
});

export const isValidPlayerInput = (input: Partial<PlayerInput>): input is PlayerInput => {
  return Boolean(
    input.divisionId &&
      input.group &&
      input.region &&
      input.affiliation &&
      input.name &&
      (input.hand === "left" || input.hand === "right"),
  );
};

export const getPlayersRef = (db: Firestore, tournamentId: string) =>
  db.collection("tournaments").doc(tournamentId).collection("players");

export const buildPlayerDocument = async (
  db: Firestore,
  tournamentId: string,
  input: PlayerInput,
  number: number,
) => {
  const shortId = await findOrCreateGlobalPlayer(db, {
    name: input.name,
    affiliation: input.affiliation,
    region: input.region,
  });

  const now = new Date().toISOString();
  return {
    tournamentId,
    shortId,
    divisionId: input.divisionId,
    group: input.group,
    region: input.region,
    affiliation: input.affiliation,
    number,
    name: input.name,
    hand: input.hand,
    createdAt: now,
    updatedAt: now,
  };
};

export const getNextPlayerNumber = async (db: Firestore, tournamentId: string) => {
  const latest = await getPlayersRef(db, tournamentId).orderBy("number", "desc").limit(1).get();
  const lastNumber = latest.docs[0]?.data().number ?? 0;
  return Number(lastNumber) + 1;
};

export const getAdminDbOrThrow = () => {
  if (!adminDb) {
    throw new Error("FIRESTORE_NOT_READY");
  }
  return adminDb;
};
