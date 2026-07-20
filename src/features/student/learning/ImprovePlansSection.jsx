import { CheckOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Skeleton, Space, Tag, Typography } from 'antd';
import { formatLearningDateTime, getPlanId, getRiskColor } from './learningProgressUtils';

const { Text } = Typography;

function ImprovePlansSection({
  plans,
  latestPlan,
  loading,
  error,
  completingPlanId,
  hasContext,
  onReload,
  onComplete,
}) {
  const completeButton = (plan) => {
    const planId = getPlanId(plan);
    if (plan.status === 'COMPLETED') return null;
    return (
      <Button
        size="small"
        type="primary"
        icon={<CheckOutlined />}
        loading={completingPlanId === planId}
        onClick={() => onComplete(planId)}
      >
        Đánh dấu hoàn tất
      </Button>
    );
  };

  return (
    <Card
      className="learning-card learning-plan-card"
      title="Kế hoạch cải thiện"
      extra={<Button size="small" icon={<ReloadOutlined />} onClick={onReload} loading={loading} disabled={!hasContext}>Tải lại</Button>}
    >
      {error && <Alert className="learning-alert" type="warning" showIcon title={error} />}
      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <>
          {latestPlan && (
            <div className="learning-latest-plan">
              <div>
                <Text strong>Kế hoạch đang thực hiện gần nhất</Text>
                <div className="learning-plan-meta">
                  <Tag color={getRiskColor(latestPlan.riskLevel)}>Mức rủi ro: {latestPlan.riskLevel || 'LOW'}</Tag>
                  <Tag>{latestPlan.status || 'ACTIVE'}</Tag>
                  {latestPlan.generatedAt && <Tag>Tạo lúc: {formatLearningDateTime(latestPlan.generatedAt)}</Tag>}
                </div>
              </div>
              {completeButton(latestPlan)}
            </div>
          )}

          {plans.length ? (
            <div className="learning-plan-list">
              {plans.map((plan) => {
                const planId = getPlanId(plan);
                return (
                  <div key={planId || `${plan.status}-${plan.generatedAt}`} className="learning-plan-item">
                    <div className="learning-plan-item-main">
                      <Space wrap>
                        <span>Kế hoạch cải thiện</span>
                        <Tag color={plan.status === 'COMPLETED' ? 'success' : 'processing'}>{plan.status || 'ACTIVE'}</Tag>
                        <Tag color={getRiskColor(plan.riskLevel)}>Rủi ro: {plan.riskLevel || 'LOW'}</Tag>
                      </Space>
                      <div className="learning-plan-detail">
                        {plan.weakTopics?.length > 0 && (
                          <div>
                            <Text strong type="secondary">Nội dung trọng tâm:</Text>
                            <div>{plan.weakTopics.map((topic) => <Tag key={topic}>{topic}</Tag>)}</div>
                          </div>
                        )}
                        <div>
                          <Text strong type="secondary">Việc cần làm:</Text>
                          <ul>{(plan.planItems || []).map((item) => <li key={item}><Text>{item}</Text></li>)}</ul>
                        </div>
                      </div>
                    </div>
                    {plan.status !== 'COMPLETED' && <div className="learning-plan-item-actions">{completeButton(plan)}</div>}
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có kế hoạch cải thiện đang hoạt động." />
          )}
        </>
      )}
    </Card>
  );
}

export default ImprovePlansSection;
