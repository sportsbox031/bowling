"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { GlassBadge, GlassButton, GlassCard, GlassInput, GlassSelect } from "@/components/ui";
import PageTitle from "@/components/common/PageTitle";
import StatusBanner from "@/components/common/StatusBanner";
import { TOURNAMENT_STATUS_LABELS } from "@/lib/constants";

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
  const meta = TOURNAMENT_STATUS_LABELS[status ?? "UPCOMING"] ?? TOURNAMENT_STATUS_LABELS.UPCOMING;
  return <GlassBadge variant={meta.variant}>{meta.label}</GlassBadge>;
};

const cardBaseStyle = {
  minHeight: 176,
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "space-between",
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
      <PageTitle
        title="볼링 대회 성적 대시보드"
        description="로그인 없이 모든 대회 성적과 선수 기록을 조회할 수 있습니다."
        meta={
          <>
            <GlassBadge variant="info">공개 조회</GlassBadge>
            <span style={{ color: "#64748b", fontSize: 14 }}>진행 중인 대회와 종료된 대회를 한 곳에서 확인하세요.</span>
          </>
        }
      />

      <GlassCard variant="strong" style={{ marginBottom: 24 }}>
        <form onSubmit={onSubmit} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 260px" }}>
            <GlassInput
              value={searchKeyword}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setSearchKeyword(event.target.value)}
              placeholder="대회명을 검색하세요..."
              label="대회명"
            />
          </div>
          <div style={{ flex: "0 1 180px" }}>
            <GlassSelect
              value={regionFilter}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => setRegionFilter(event.target.value)}
              label="지역"
            >
              <option value="">전체 시군</option>
              {regions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </GlassSelect>
          </div>
          <div style={{ flex: "0 1 140px" }}>
            <GlassSelect
              value={yearFilter}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => setYearFilter(event.target.value)}
              label="연도"
            >
              <option value="">전체 연도</option>
              {years.map((year) => (
                <option key={year} value={String(year)}>
                  {year}년
                </option>
              ))}
            </GlassSelect>
          </div>
          <GlassButton type="submit" isLoading={loading} size="md">
            {loading ? "검색 중..." : "검색"}
          </GlassButton>
        </form>
      </GlassCard>

      {message && <StatusBanner tone="error" style={{ marginBottom: 16 }}>{message}</StatusBanner>}

      <section style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
        {loading
          ? Array.from({ length: 6 }).map((_, index) => (
              <GlassCard key={index} style={cardBaseStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div className="skeleton" style={{ height: 22, width: "62%", borderRadius: 6 }} />
                  <div className="skeleton" style={{ height: 22, width: "22%", borderRadius: 20 }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="skeleton" style={{ height: 14, width: "78%", borderRadius: 4 }} />
                  <div className="skeleton" style={{ height: 14, width: "52%", borderRadius: 4 }} />
                  <div className="skeleton" style={{ height: 14, width: "38%", borderRadius: 4 }} />
                </div>
              </GlassCard>
            ))
          : items.map((tournament) => (
              <Link key={tournament.id} href={`/tournaments/${tournament.id}`} style={{ textDecoration: "none" }}>
                <GlassCard hover style={cardBaseStyle}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 8 }}>
                      <h2
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          color: "#1e293b",
                          margin: 0,
                          lineHeight: 1.4,
                          flex: 1,
                        }}
                      >
                        {tournament.title}
                      </h2>
                      {statusBadge(tournament.status)}
                    </div>
                    <p style={{ color: "#64748b", fontSize: 14, margin: 0, lineHeight: 1.6 }}>
                      {tournament.startsAt} ~ {tournament.endsAt}
                    </p>
                  </div>
                  <div style={{ display: "grid", gap: 8, marginTop: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ color: "#64748b", fontSize: 13 }}>지역</span>
                      <span style={{ color: "#1e293b", fontWeight: 600, fontSize: 14 }}>{tournament.region}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ color: "#64748b", fontSize: 13 }}>시즌</span>
                      <span style={{ color: "#6366f1", fontWeight: 700, fontSize: 14 }}>{tournament.seasonYear}년</span>
                    </div>
                  </div>
                </GlassCard>
              </Link>
            ))}
      </section>

      {!loading && items.length === 0 && !message && (
        <GlassCard variant="subtle" style={{ textAlign: "center", padding: "3rem 1rem", marginTop: 16 }}>
          <p style={{ fontSize: 48, marginBottom: 12 }}>🎳</p>
          <p style={{ color: "#94a3b8", fontSize: 16 }}>조회된 대회가 없습니다</p>
        </GlassCard>
      )}
    </main>
  );
};

export default HomePage;
