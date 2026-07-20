import { Tabs } from 'antd';
import ContributionLibrary from './ContributionLibrary';
import SeniorReviewQueue from './SeniorReviewQueue';

export default function ExpertContentReviewWorkspace({
  resources,
  userId,
  canReview,
  selectedReviewId,
  loading,
  error,
  pendingAction,
  onSelectReview,
  onRefresh,
  onReviewGoldQa,
  onReviewRubric,
}) {
  const library = (
    <ContributionLibrary
      goldQa={resources.goldQa}
      rubrics={resources.rubrics}
      userId={userId}
      canReview={canReview}
      loading={loading}
      error={error}
      onRefresh={onRefresh}
    />
  );

  if (!canReview) return library;

  return (
    <Tabs
      className="expert-training__content-tabs"
      defaultActiveKey="review"
      items={[
        {
          key: 'review',
          label: 'Chờ kiểm duyệt',
          children: (
            <SeniorReviewQueue
              goldQa={resources.goldQa}
              rubrics={resources.rubrics}
              selectedReviewId={selectedReviewId}
              loading={loading}
              error={error}
              pendingAction={pendingAction}
              onSelectReview={onSelectReview}
              onRefresh={onRefresh}
              onReviewGoldQa={onReviewGoldQa}
              onReviewRubric={onReviewRubric}
            />
          ),
        },
        {
          key: 'library',
          label: 'Thư viện nội dung',
          children: library,
        },
      ]}
    />
  );
}
