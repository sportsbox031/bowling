import PageLoading from "@/components/common/PageLoading";

export default function Loading() {
  return <PageLoading title="대회 정보를 불러오고 있습니다" description="공개 대회 목록과 기본 정보를 빠르게 준비하고 있습니다." mode="public" layout="cards" />;
}
