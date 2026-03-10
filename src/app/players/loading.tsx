import PageLoading from "@/components/common/PageLoading";

export default function Loading() {
  return <PageLoading title="선수 랭킹을 불러오고 있습니다" description="누적 성적과 평균 기록을 집계하고 있습니다." mode="public" layout="table" />;
}
