import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export async function GET(req: NextRequest) {
  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const query = new URL(req.url).searchParams;
  const keyword = (query.get("q") ?? "").toLowerCase().trim();
  const year = Number(query.get("year"));
  const region = (query.get("region") ?? "").toLowerCase().trim();

  const snapshot = await adminDb
    .collection("tournaments")
    .orderBy("startsAt", "desc")
    .get();

  const all = snapshot.docs.map((doc) => {
    const data = doc.data() as Record<string, any>;
    return { id: doc.id, ...data };
  });

  const filtered = all.filter((t: any) => {
    if (Number.isFinite(year) && t.seasonYear !== year) {
      return false;
    }
    if (region && typeof t.region === "string" && !t.region.toLowerCase().includes(region)) {
      return false;
    }
    if (keyword && typeof t.title === "string" && !t.title.toLowerCase().includes(keyword)) {
      return false;
    }
    return true;
  });

  return NextResponse.json({ items: filtered });
}
