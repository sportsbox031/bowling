import PageLoading from "@/components/common/PageLoading";

export default function Loading() {
  return <PageLoading title="대회 관리 목록을 불러오고 있습니다" description="관리 가능한 대회와 기본 정보를 준비하고 있습니다." mode="admin" layout="table" />;
}
