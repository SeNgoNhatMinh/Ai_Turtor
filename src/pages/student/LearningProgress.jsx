import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Progress,
  Skeleton,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  BookOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined,
  PushpinOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import CanvasGraph from '../../components/CanvasGraph';
import PageHeader from '../../components/common/PageHeader';
import { studentLearningApi } from '../../services/studentLearningApi';
import { getUserFacingError } from '../../services/apiClient';
import { uiCopy } from '../../constants/uiCopy';

const { Text, Title } = Typography;

const STAT_META = {
  activeCourses: { label: 'Active courses', description: 'Courses currently tracked', icon: <BookOutlined /> },
  totalAssignments: { label: 'Assignments', description: 'Tasks in this course context', icon: <FileTextOutlined /> },
  submittedTasks: { label: 'Submitted', description: 'Assignments already submitted', icon: <CheckCircleOutlined /> },
  supportRequests: { label: 'Support requests', description: 'Questions escalated to mentors', icon: <InfoCircleOutlined /> },
};

const getSuggestionText = (suggestion) => suggestion?.title || suggestion?.content || String(suggestion || '');
const normalizeSuggestionKey = (value) => String(value || '').trim().toLowerCase();
const getPlanId = (plan) => plan?.id || plan?.planId;

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const makePinnedSuggestionItem = (text) => ({
  priority: 'pinned',
  title: text,
  content: 'Pinned for focused review.',
  pinnedOnly: true,
});

const getMasteryStatus = (rate) => {
  if (rate >= 75) return { label: 'Strong foundation', tone: 'success' };
  if (rate >= 45) return { label: 'Building consistency', tone: 'warning' };
  return { label: 'Needs focused practice', tone: 'error' };
};

const getRiskColor = (riskLevel) => {
  const value = String(riskLevel || '').toUpperCase();
  if (value === 'HIGH') return 'error';
  if (value === 'MEDIUM') return 'warning';
  return 'success';
};

function LearningProgress({
  learnedTopics,
  weakTopics,
  suggestions,
  isSuggesting,
  refreshSuggestions,
  isLoading = false,
  dashboardStats = {},
  onRefreshDashboard,
  onUpdateMemory,
  pinnedSuggestions = [],
  onPinSuggestion,
  onUnpinSuggestion,
  onStudySuggestion,
  onCreateQuizFromSuggestion,
  memorySummary = '',
  recentQuestions = [],
  memoryUpdatedAt = '',
  studentId = '',
  courseId = '',
  classId = '',
  triggerToast,
}) {
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [newLearnedText, setNewLearnedText] = useState(learnedTopics ? learnedTopics.join(', ') : '');
  const [newWeakText, setNewWeakText] = useState(weakTopics ? weakTopics.join(', ') : '');
  const [improvePlans, setImprovePlans] = useState([]);
  const [latestPlan, setLatestPlan] = useState(null);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [plansError, setPlansError] = useState('');
  const [savingMemory, setSavingMemory] = useState(false);
  const [completingPlanId, setCompletingPlanId] = useState('');

  const safeLearnedTopics = Array.isArray(learnedTopics) ? learnedTopics : [];
  const safeWeakTopics = Array.isArray(weakTopics) ? weakTopics : [];
  const safeSuggestions = useMemo(
    () => (Array.isArray(suggestions) ? suggestions : []),
    [suggestions],
  );
  const safePinnedSuggestions = useMemo(
    () => (Array.isArray(pinnedSuggestions) ? pinnedSuggestions : []),
    [pinnedSuggestions],
  );
  const safeRecentQuestions = Array.isArray(recentQuestions) ? recentQuestions.filter(Boolean).slice(-5).reverse() : [];
  const formattedMemoryTime = formatDateTime(memoryUpdatedAt);
  const hasContext = Boolean(studentId && courseId);

  const totalTopics = safeLearnedTopics.length + safeWeakTopics.length;
  const masteryRate = totalTopics > 0 ? Math.round((safeLearnedTopics.length / totalTopics) * 100) : 0;
  const masteryStatus = getMasteryStatus(masteryRate);

  const statEntries = useMemo(() => {
    const entries = Object.entries(dashboardStats || {}).filter(([, value]) => value != null && value !== '');
    return entries.map(([key, value]) => ({
      key,
      value,
      ...(STAT_META[key] || {
        label: key.replace(/([A-Z])/g, ' $1').trim(),
        description: 'Learning metric',
        icon: <ThunderboltOutlined />,
      }),
    }));
  }, [dashboardStats]);

  const pinnedSet = useMemo(
    () => new Set(safePinnedSuggestions.map((item) => normalizeSuggestionKey(item))),
    [safePinnedSuggestions],
  );

  const orderedSuggestions = useMemo(() => {
    const suggestionMap = new Map();
    safeSuggestions.forEach((suggestion) => {
      const key = normalizeSuggestionKey(getSuggestionText(suggestion));
      if (key && !suggestionMap.has(key)) suggestionMap.set(key, suggestion);
    });

    const pinnedItems = safePinnedSuggestions.map((item) => {
      const key = normalizeSuggestionKey(item);
      return suggestionMap.get(key) || makePinnedSuggestionItem(item);
    });

    const regularItems = safeSuggestions.filter((suggestion) => !pinnedSet.has(normalizeSuggestionKey(getSuggestionText(suggestion))));
    return [...pinnedItems, ...regularItems];
  }, [safeSuggestions, safePinnedSuggestions, pinnedSet]);

  const topFocusItems = safePinnedSuggestions.length ? safePinnedSuggestions : safeWeakTopics.slice(0, 4);

  const fetchImprovePlans = useCallback(async () => {
    if (!hasContext) {
      setImprovePlans([]);
      setLatestPlan(null);
      return;
    }
    setLoadingPlans(true);
    setPlansError('');
    try {
      const [plans, latest] = await Promise.all([
        studentLearningApi.getImprovePlans(studentId, courseId),
        studentLearningApi.getLatestImprovePlan(studentId, courseId),
      ]);
      setImprovePlans(plans);
      setLatestPlan(latest);
    } catch (error) {
      const message = getUserFacingError(error, 'Unable to load improvement plans.');
      setPlansError(message);
      triggerToast?.(message);
    } finally {
      setLoadingPlans(false);
    }
  }, [courseId, hasContext, studentId, triggerToast]);

  useEffect(() => {
    const loadTimer = window.setTimeout(fetchImprovePlans, 0);
    return () => window.clearTimeout(loadTimer);
  }, [fetchImprovePlans]);

  const handleAnalyzeMemory = async () => {
    if (!hasContext || isSuggesting) return;
    await refreshSuggestions?.();
    await fetchImprovePlans();
    onRefreshDashboard?.();
  };

  const handleMarkComplete = async (planId) => {
    if (!planId || completingPlanId) return;
    setCompletingPlanId(planId);
    try {
      await studentLearningApi.completeImprovePlan(planId);
      triggerToast?.('Improvement plan completed.');
      await fetchImprovePlans();
      onRefreshDashboard?.();
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Unable to complete this improvement plan.'));
    } finally {
      setCompletingPlanId('');
    }
  };

  const handleSaveMemory = async () => {
    const learnedList = newLearnedText.split(',').map((item) => item.trim()).filter(Boolean);
    const weakList = newWeakText.split(',').map((item) => item.trim()).filter(Boolean);
    setSavingMemory(true);
    try {
      await onUpdateMemory?.(learnedList, weakList);
      setEditModalVisible(false);
      onRefreshDashboard?.();
    } finally {
      setSavingMemory(false);
    }
  };

  if (isLoading) {
    return (
      <div className="portal-section center-state">
        <Spin size="large" description="Loading learning dashboard..." />
      </div>
    );
  }

  return (
    <div className="portal-section learning-dashboard">
      <PageHeader
        title={uiCopy.student.progress.title}
        description={uiCopy.student.progress.subtitle}
        actions={(
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={onRefreshDashboard} disabled={!hasContext}>
              Refresh dashboard
            </Button>
            <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleAnalyzeMemory} loading={isSuggesting} disabled={!hasContext}>
              Analyze memory
            </Button>
          </Space>
        )}
      />

      {!hasContext && (
        <Alert
          type="warning"
          showIcon
          className="learning-alert"
          message="Choose a course first"
          description="Learning progress is scoped by student and course. Select an enrolled course to load memory, suggestions, and quiz plans."
        />
      )}

      <div className="learning-hero-grid">
        <Card className="learning-card learning-card--hero">
          <div className="learning-card-kicker">Learning Snapshot</div>
          <div className="learning-hero-content">
            <div>
              <Title level={3} className="learning-card-title">Course learning state</Title>
              <Text className="learning-card-description">
                This snapshot combines course memory, weak topics, submitted work, support history, and quiz results.
              </Text>
              <div className="learning-scope-row">
                {courseId && <Tag>Course: {courseId}</Tag>}
                {classId && <Tag>Class: {classId}</Tag>}
                {formattedMemoryTime && <Tag>Updated: {formattedMemoryTime}</Tag>}
              </div>
            </div>
            <div className="learning-progress-ring">
              <Progress
                type="circle"
                percent={masteryRate}
                width={132}
                strokeColor={masteryRate >= 75 ? '#16A34A' : masteryRate >= 45 ? '#F59E0B' : '#EF4444'}
                format={(percent) => <span className="learning-progress-value">{percent}%</span>}
              />
              <Tag color={masteryStatus.tone} className="learning-status-tag">{masteryStatus.label}</Tag>
            </div>
          </div>
        </Card>

        <Card className="learning-card learning-card--focus">
          <div className="learning-card-kicker">Next best focus</div>
          <Title level={4} className="learning-card-title">Review queue</Title>
          {topFocusItems.length ? (
            <div className="learning-focus-list">
              {topFocusItems.map((item) => (
                <Tag
                  key={item}
                  className="learning-focus-chip"
                  closable={safePinnedSuggestions.includes(item) && Boolean(onUnpinSuggestion)}
                  onClose={(event) => {
                    event.preventDefault();
                    onUnpinSuggestion?.(item);
                  }}
                >
                  {safePinnedSuggestions.includes(item) && <PushpinOutlined />}
                  {item}
                </Tag>
              ))}
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No focus items yet" />
          )}
        </Card>
      </div>

      <div className="learning-stat-grid">
        <Card className="learning-card learning-stat-card">
          <div className="learning-stat-icon"><CheckCircleOutlined /></div>
          <div>
            <div className="learning-stat-label">Learned topics</div>
            <div className="learning-stat-value">{safeLearnedTopics.length}</div>
            <div className="learning-stat-description">Topics marked as understood</div>
          </div>
        </Card>
        <Card className="learning-card learning-stat-card">
          <div className="learning-stat-icon"><CloseCircleOutlined /></div>
          <div>
            <div className="learning-stat-label">Weak topics</div>
            <div className="learning-stat-value">{safeWeakTopics.length}</div>
            <div className="learning-stat-description">Focus areas from memory and quizzes</div>
          </div>
        </Card>
        {statEntries.map((stat) => (
          <Card key={stat.key} className="learning-card learning-stat-card">
            <div className="learning-stat-icon">{stat.icon}</div>
            <div>
              <div className="learning-stat-label">{stat.label}</div>
              <div className="learning-stat-value">{String(stat.value)}</div>
              <div className="learning-stat-description">{stat.description}</div>
            </div>
          </Card>
        ))}
      </div>

      <div className="learning-context-grid">
        <Card
          className="learning-card learning-context-card"
          title="Course Memory"
          extra={(
            <Button
              size="small"
              onClick={() => {
                setNewLearnedText(safeLearnedTopics.join(', '));
                setNewWeakText(safeWeakTopics.join(', '));
                setEditModalVisible(true);
              }}
              disabled={!hasContext}
            >
              Edit memory
            </Button>
          )}
        >
          {memorySummary ? (
            <Alert type="info" showIcon icon={<BulbOutlined />} message="Memory summary" description={memorySummary} />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No memory summary yet. Ask AI Tutor questions or submit quizzes to build course memory." />
          )}
          <div className="learning-memory-grid">
            <div className="learning-topic-section">
              <div className="learning-topic-header">
                <CheckCircleOutlined />
                <Text strong>Learned topics</Text>
                <Tag>{safeLearnedTopics.length}</Tag>
              </div>
              <div className="learning-topic-cloud learning-topic-cloud--learned">
                {safeLearnedTopics.length ? safeLearnedTopics.map((topic) => <Tag key={topic}>{topic}</Tag>) : <Text type="secondary">No learned topics recorded yet.</Text>}
              </div>
            </div>
            <div className="learning-topic-section">
              <div className="learning-topic-header">
                <CloseCircleOutlined />
                <Text strong>Focus areas</Text>
                <Tag color={safeWeakTopics.length ? 'warning' : 'success'}>{safeWeakTopics.length}</Tag>
              </div>
              <div className="learning-topic-cloud learning-topic-cloud--weak">
                {safeWeakTopics.length ? safeWeakTopics.map((topic) => <Tag key={topic}>{topic}</Tag>) : <Text type="secondary">No weak concepts currently.</Text>}
              </div>
            </div>
          </div>
        </Card>

        <Card className="learning-card learning-context-card" title="Recent learning signals">
          {safeRecentQuestions.length ? (
            <div className="learning-recent-list">
              {safeRecentQuestions.map((question, index) => (
                <div key={`${question}-${index}`} className="learning-recent-item">
                  <HistoryOutlined />
                  <span>{question}</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No recent questions recorded yet" />
          )}
        </Card>
      </div>

      <Card
        className="learning-card learning-plan-card"
        title="Study Suggestions"
        extra={(
          <Button icon={<ThunderboltOutlined />} onClick={handleAnalyzeMemory} loading={isSuggesting} disabled={!hasContext}>
            Analyze again
          </Button>
        )}
      >
        {isSuggesting ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : (
          orderedSuggestions.length ? (
            <div className="learning-suggestion-list">
              {orderedSuggestions.map((suggestion) => {
              const isHigh = suggestion.priority === 'high';
              const suggestionText = getSuggestionText(suggestion);
              const isPinned = pinnedSet.has(normalizeSuggestionKey(suggestionText));
              const canStudySuggestion = Boolean(hasContext && onStudySuggestion);
              const openSuggestion = () => {
                if (canStudySuggestion) onStudySuggestion?.(suggestionText);
              };

              return (
                <div key={normalizeSuggestionKey(suggestionText) || suggestion.title} className={`learning-suggestion-item ${isPinned ? 'learning-suggestion-item--pinned' : ''}`}>
                  <div
                    className={`learning-suggestion-copy ${canStudySuggestion ? 'learning-suggestion-copy--clickable' : ''}`}
                    role={canStudySuggestion ? 'button' : undefined}
                    tabIndex={canStudySuggestion ? 0 : undefined}
                    onClick={openSuggestion}
                    onKeyDown={(event) => {
                      if (!canStudySuggestion) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openSuggestion();
                      }
                    }}
                    aria-label={canStudySuggestion ? `Study suggestion: ${suggestionText}` : undefined}
                  >
                    <Tag color={isPinned ? 'orange' : isHigh ? 'error' : 'default'}>
                      {isPinned ? 'Pinned' : isHigh ? 'High priority' : 'Recommended'}
                    </Tag>
                    <Text strong>{suggestion.title || 'Study suggestion'}</Text>
                    <Text type="secondary">{suggestion.content || 'Practice and review this topic.'}</Text>
                  </div>
                  <Space className="learning-suggestion-actions" size={8} wrap>
                    <Tooltip title="Open this topic in AI Tutor Chat">
                      <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={() => onStudySuggestion?.(suggestionText)} disabled={!hasContext || !onStudySuggestion}>
                        Study now
                      </Button>
                    </Tooltip>
                    <Tooltip title="Create a self-study quiz from indexed course materials">
                      <Button size="small" icon={<QuestionCircleOutlined />} onClick={() => onCreateQuizFromSuggestion?.(suggestionText)} disabled={!hasContext || !onCreateQuizFromSuggestion}>
                        Create quiz
                      </Button>
                    </Tooltip>
                    <Button
                      size="small"
                      type={isPinned ? 'default' : 'text'}
                      icon={<PushpinOutlined />}
                      disabled={!hasContext || (!onPinSuggestion && !onUnpinSuggestion)}
                      onClick={() => (isPinned ? onUnpinSuggestion?.(suggestionText) : onPinSuggestion?.(suggestionText))}
                    >
                      {isPinned ? 'Unpin' : 'Pin'}
                    </Button>
                  </Space>
                </div>
              );
              })}
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No study suggestions yet. Analyze memory to generate next steps." />
          )
        )}
      </Card>

      <Card
        className="learning-card learning-plan-card"
        title="Improve Plans"
        extra={<Button size="small" icon={<ReloadOutlined />} onClick={fetchImprovePlans} loading={loadingPlans} disabled={!hasContext}>Reload plans</Button>}
      >
        {plansError && <Alert className="learning-alert" type="warning" showIcon message={plansError} />}
        {loadingPlans ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : (
          <>
            {latestPlan && (
              <div className="learning-latest-plan">
                <div>
                  <Text strong>Latest active plan</Text>
                  <div className="learning-plan-meta">
                    <Tag color={getRiskColor(latestPlan.riskLevel)}>{latestPlan.riskLevel || 'LOW'} risk</Tag>
                    <Tag>{latestPlan.status || 'ACTIVE'}</Tag>
                    {latestPlan.generatedAt && <Tag>Generated: {formatDateTime(latestPlan.generatedAt)}</Tag>}
                  </div>
                </div>
                {latestPlan.status !== 'COMPLETED' && (
                  <Button
                    size="small"
                    type="primary"
                    icon={<CheckOutlined />}
                    loading={completingPlanId === getPlanId(latestPlan)}
                    onClick={() => handleMarkComplete(getPlanId(latestPlan))}
                  >
                    Mark complete
                  </Button>
                )}
              </div>
            )}

            {improvePlans.length ? (
              <div className="learning-plan-list">
                {improvePlans.map((plan) => {
                const planId = getPlanId(plan);
                return (
                  <div
                    key={planId || `${plan.status}-${plan.generatedAt}`}
                    className="learning-plan-item"
                  >
                    <div className="learning-plan-item-main">
                      <Space wrap>
                        <span>Improvement Plan</span>
                        <Tag color={plan.status === 'COMPLETED' ? 'success' : 'processing'}>{plan.status || 'ACTIVE'}</Tag>
                        <Tag color={getRiskColor(plan.riskLevel)}>{plan.riskLevel || 'LOW'} risk</Tag>
                      </Space>
                      <div className="learning-plan-detail">
                        {plan.weakTopics?.length > 0 && (
                          <div>
                            <Text strong type="secondary">Focus areas:</Text>
                            <div>{plan.weakTopics.map((topic) => <Tag key={topic}>{topic}</Tag>)}</div>
                          </div>
                        )}
                        <div>
                          <Text strong type="secondary">Action items:</Text>
                          <ul>
                            {(plan.planItems || []).map((item) => <li key={item}><Text>{item}</Text></li>)}
                          </ul>
                        </div>
                      </div>
                    </div>
                    {plan.status !== 'COMPLETED' && (
                      <div className="learning-plan-item-actions">
                        <Button
                          type="primary"
                          size="small"
                          icon={<CheckOutlined />}
                          loading={completingPlanId === planId}
                          onClick={() => handleMarkComplete(planId)}
                        >
                          Mark complete
                        </Button>
                      </div>
                    )}
                  </div>
                );
                })}
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No active improvement plans." />
            )}
          </>
        )}
      </Card>

      <div className="learning-main-grid">
        <Card className="learning-card learning-map-card" title={uiCopy.student.progress.networkTitle}>
          <div className="knowledge-network-frame learning-network-frame">
            <CanvasGraph />
          </div>
        </Card>
      </div>

      <Modal
        title="Edit course memory"
        open={editModalVisible}
        onOk={handleSaveMemory}
        confirmLoading={savingMemory}
        onCancel={() => {
          setEditModalVisible(false);
          setNewLearnedText(safeLearnedTopics.join(', '));
          setNewWeakText(safeWeakTopics.join(', '));
        }}
        okText="Save memory"
        cancelText="Cancel"
      >
        <div className="learning-edit-form">
          <label>
            <span>Learned topics</span>
            <Input.TextArea rows={3} placeholder="Example: MVC Flow, JPA Repository, SQL Basics" value={newLearnedText} onChange={(event) => setNewLearnedText(event.target.value)} />
          </label>
          <label>
            <span>Weak topics</span>
            <Input.TextArea rows={3} placeholder="Example: Binary conversion, CPU scheduling" value={newWeakText} onChange={(event) => setNewWeakText(event.target.value)} />
          </label>
        </div>
      </Modal>
    </div>
  );
}

export default LearningProgress;
