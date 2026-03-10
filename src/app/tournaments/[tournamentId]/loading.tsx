import PageLoading from "@/components/common/PageLoading";

export default function Loading() {
  return <PageLoading title="대회 상세 정보를 불러오고 있습니다" description="부문과 세부종목 목록을 준비하고 있습니다." mode="public" layout="detail" />;
}
