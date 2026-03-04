"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useMemo, useState, useEffect } from "react";
import { GlassCard, GlassButton, GlassInput, GlassSelect, GlassBadge } from "@/components/ui";

type Tournament = {
  id: string;
  title: string;
  region: string;
  seasonYear: number;
  startsAt: string;
  endsAt: string;
  status?: string;
};

type TournamentApiResponse = { items: Tournament[] };

const toYearOptions = (items: Tournament[]) =>
  Array.from(new Set(items.map((item) => item.seasonYear).filter(Boolean))).sort((a, b) => b - a);

const statusBadge = (status?: string) => {
  switch (status) {
    case "ONGOING":
      return <GlassBadge variant="success">진행중</GlassBadge>;
    case "FINISHED":
      return <GlassBadge variant="default">종료</GlassBadge>;
    default:
      return <GlassBadge variant="info">예정</GlassBadge>;
  }
};

const HomePage = () => {
  const [items, setItems] = useState<Tournament[]>([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = async (params: { keyword?: string; region?: string; year?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.keyword?.trim()) query.set("q", params.keyword.trim());
    if (params.region?.trim()) query.set("region", params.region.trim());
    if (params.year?.trim()) query.set("year", params.year);

    setLoading(true);
    try {
      const response = await fetch(`/api/public/tournaments?${query.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("대회 목록을 불러오지 못했습니다.");
      }
      const data = (await response.json()) as TournamentApiResponse;
      setItems(data.items ?? []);
      setMessage("");
    } catch (error) {
      setMessage((error as Error).message || "조회 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const regions = useMemo(() => {
    const unique = Array.from(new Set(items.map((item) => item.region).filter(Boolean)));
    return unique.sort((a, b) => a.localeCompare(b));
  }, [items]);

  const years = useMemo(() => toYearOptions(items), [items]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    load({ keyword: searchKeyword, region: regionFilter, year: yearFilter });
  };

  return (
    <main>
      {/* Hero Section */}
      <div style={{ textAlign: "center", padding: "2.5rem 0 2rem" }}>
        <h1
          style={{
            fontSize: 36,
            fontWeight: 900,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a78bfa)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: 8,
            letterSpacing: "-0.03em",
          }}
        >
          볼링 대회 성적 대시보드
        </h1>
        <p style={{ color: "#64748b", fontSize: 16, fontWeight: 400 }}>
          로그인 없이 모든 대회 성적을 조회할 수 있습니다
        </p>
      </div>

      {/* Search Section */}
      <GlassCard variant="strong" style={{ marginBottom: 24 }}>
        <form onSubmit={onSubmit} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 240px" }}>
            <GlassInput
              value={searchKeyword}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setSearchKeyword(event.target.value)}
              placeholder="대회명을 검색하세요..."
            />
          </div>
          <div style={{ flex: "0 1 160px" }}>
            <GlassSelect
              value={regionFilter}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => setRegionFilter(event.target.value)}
            >
              <option value="">전체 시군</option>
              {regions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </GlassSelect>
          </div>
          <div style={{ flex: "0 1 130px" }}>
            <GlassSelect
              value={yearFilter}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => setYearFilter(event.target.value)}
            >
              <option value="">전체 연도</option>
              {years.map((year) => (
                <option key={year} value={String(year)}>
                  {year}년
                </option>
              ))}
            </GlassSelect>
          </div>
          <GlassButton type="submit" disabled={loading} size="md">
            {loading ? "검색 중..." : "검색"}
          </GlassButton>
        </form>
      </GlassCard>

      {message && (
        <GlassCard variant="subtle" style={{ marginBottom: 16, color: "#ef4444" }}>
          {message}
        </GlassCard>
      )}

      {/* Tournament Grid */}
      <section style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
        {items.map((tournament) => (
          <Link key={tournament.id} href={`/tournaments/${tournament.id}`} style={{ textDecoration: "none" }}>
            <GlassCard hover>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <h2
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#1e293b",
                    margin: 0,
                    lineHeight: 1.4,
                    flex: 1,
                    marginRight: 8,
                  }}
                >
                  {tournament.title}
                </h2>
                {statusBadge(tournament.status)}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748b", fontSize: 14 }}>
                  <span>📅</span>
                  <span>{tournament.startsAt} ~ {tournament.endsAt}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748b", fontSize: 14 }}>
                  <span>📍</span>
                  <span>{tournament.region}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span>🎳</span>
                  <span style={{ color: "#6366f1", fontWeight: 600, fontSize: 14 }}>{tournament.seasonYear}년 시즌</span>
                </div>
              </div>
            </GlassCard>
          </Link>
        ))}
      </section>

      {!loading && items.length === 0 && (
        <GlassCard variant="subtle" style={{ textAlign: "center", padding: "3rem 1rem", marginTop: 16 }}>
          <p style={{ fontSize: 48, marginBottom: 12 }}>🎳</p>
          <p style={{ color: "#94a3b8", fontSize: 16 }}>조회된 대회가 없습니다</p>
        </GlassCard>
      )}
    </main>
  );
};

export default HomePage;
