import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Empty, Input, List, Modal, Progress, Spin, Tag, Typography } from 'antd';
import {
  BookOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  PushpinOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import CanvasGraph from '../../components/CanvasGraph';
import PageHeader from '../../components/common/PageHeader';
import { uiCopy } from '../../constants/uiCopy';

const { Text, Title } = Typography;

const STAT_META = {
  activeCourses: {
    label: 'Active courses',
    description: 'Courses currently tracked',
    icon: <BookOutlined />,
  },
  totalAssignments: {
    label: 'Assignments',
    description: 'Tasks in this course context',
    icon: <FileTextOutlined />,
  },
  submittedTasks: {
    label: 'Submitted',
    description: 'Assignments already submitted',
    icon: <CheckCircleOutlined />,
  },
  supportRequests: {
    label: 'Support requests',
    description: 'Questions escalated to mentors',
    icon: <InfoCircleOutlined />,
  },
};

const getSuggestionText = (suggestion) => suggestion?.title || suggestion?.content || String(suggestion || '');

const normalizeSuggestionKey = (value) => String(value || '').trim().toLowerCase();

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
}) {
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [newLearnedText, setNewLearnedText] = useState(learnedTopics ? learnedTopics.join(', ') : '');
  const [newWeakText, setNewWeakText] = useState(weakTopics ? weakTopics.join(', ') : '');

  useEffect(() => {
    setNewLearnedText(learnedTopics ? learnedTopics.join(', ') : '');
  }, [learnedTopics]);

  useEffect(() => {
    setNewWeakText(weakTopics ? weakTopics.join(', ') : '');
  }, [weakTopics]);

  const safeLearnedTopics = Array.isArray(learnedTopics) ? learnedTopics : [];
  const safeWeakTopics = Array.isArray(weakTopics) ? weakTopics : [];
  const safeSuggestions = Array.isArray(suggestions) ? suggestions : [];
  const safePinnedSuggestions = Array.isArray(pinnedSuggestions) ? pinnedSuggestions : [];

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
      if (key && !suggestionMap.has(key)) {
        suggestionMap.set(key, suggestion);
      }
    });

    const pinnedItems = safePinnedSuggestions.map((item) => {
      const key = normalizeSuggestionKey(item);
      return suggestionMap.get(key) || makePinnedSuggestionItem(item);
    });

    const regularItems = safeSuggestions.filter((suggestion) => {
      const key = normalizeSuggestionKey(getSuggestionText(suggestion));
      return !pinnedSet.has(key);
    });

    return [...pinnedItems, ...regularItems];
  }, [safeSuggestions, safePinnedSuggestions, pinnedSet]);

  const topFocusItems = safePinnedSuggestions.length
    ? safePinnedSuggestions
    : safeWeakTopics.slice(0, 4);

  if (isLoading) {
    return (
      <div className="portal-section center-state">
        <Spin size="large" tip="Loading learning dashboard..." />
      </div>
    );
  }

  return (
    <div className="portal-section learning-dashboard">
      <PageHeader
        title={uiCopy.student.progress.title}
        description={uiCopy.student.progress.subtitle}
        actions={onRefreshDashboard ? (
          <Button icon={<ReloadOutlined />} onClick={onRefreshDashboard}>
            Refresh
          </Button>
        ) : null}
      />

      <div className="learning-hero-grid">
        <Card className="learning-card learning-card--hero">
          <div className="learning-card-kicker">Course memory snapshot</div>
          <div className="learning-hero-content">
            <div>
              <Title level={3} className="learning-card-title">Learning progress</Title>
              <Text className="learning-card-description">
                This dashboard uses your course memory, weak topics, assignments, and mentor support history to decide what to review next.
              </Text>
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

      {statEntries.length > 0 && (
        <div className="learning-stat-grid">
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
      )}

      <div className="learning-main-grid">
        <Card className="learning-card learning-map-card" title={uiCopy.student.progress.networkTitle}>
          <div className="knowledge-network-frame learning-network-frame">
            <CanvasGraph />
          </div>
        </Card>

        <Card
          className="learning-card learning-profiler-card"
          title="Knowledge profiler"
          extra={<Button size="small" onClick={() => setEditModalVisible(true)}>Edit</Button>}
        >
          <div className="learning-topic-section">
            <div className="learning-topic-header">
              <CheckCircleOutlined />
              <Text strong>Mastered concepts</Text>
              <Tag>{safeLearnedTopics.length}</Tag>
            </div>
            <div className="learning-topic-cloud learning-topic-cloud--learned">
              {safeLearnedTopics.length ? safeLearnedTopics.map((topic) => (
                <Tag key={topic}>{topic}</Tag>
              )) : <Text type="secondary">No mastered concepts recorded yet.</Text>}
            </div>
          </div>

          <div className="learning-topic-section">
            <div className="learning-topic-header">
              <CloseCircleOutlined />
              <Text strong>Focus areas</Text>
              <Tag color={safeWeakTopics.length ? 'warning' : 'success'}>{safeWeakTopics.length}</Tag>
            </div>
            <div className="learning-topic-cloud learning-topic-cloud--weak">
              {safeWeakTopics.length ? safeWeakTopics.map((topic) => (
                <Tag key={topic}>{topic}</Tag>
              )) : <Text type="secondary">No weak concepts currently.</Text>}
            </div>
          </div>
        </Card>
      </div>

      <Card
        className="learning-card learning-plan-card"
        title={uiCopy.student.progress.suggestionsTitle}
        extra={(
          <Button icon={<ThunderboltOutlined />} onClick={refreshSuggestions} loading={isSuggesting}>
            Analyze again
          </Button>
        )}
      >
        <List
          dataSource={orderedSuggestions}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No study suggestions yet" /> }}
          renderItem={(suggestion) => {
            const isHigh = suggestion.priority === 'high';
            const suggestionText = getSuggestionText(suggestion);
            const isPinned = pinnedSet.has(normalizeSuggestionKey(suggestionText));

            return (
              <List.Item className={`learning-suggestion-item ${isPinned ? 'learning-suggestion-item--pinned' : ''}`}>
                <div className="learning-suggestion-copy">
                  <Tag color={isPinned ? 'orange' : isHigh ? 'error' : 'default'}>
                    {isPinned ? 'Pinned' : isHigh ? 'High priority' : 'Recommended'}
                  </Tag>
                  <Text strong>{suggestion.title || 'Study suggestion'}</Text>
                  <Text type="secondary">{suggestion.content || 'Practice and review this topic.'}</Text>
                </div>
                {(onPinSuggestion || onUnpinSuggestion) && (
                  <Button
                    size="small"
                    type={isPinned ? 'primary' : 'default'}
                    icon={<PushpinOutlined />}
                    onClick={() => {
                      if (isPinned) {
                        onUnpinSuggestion?.(suggestionText);
                      } else {
                        onPinSuggestion?.(suggestionText);
                      }
                    }}
                  >
                    {isPinned ? 'Pinned' : 'Pin'}
                  </Button>
                )}
              </List.Item>
            );
          }}
        />
      </Card>

      <Modal
        title="Edit knowledge profiler"
        open={editModalVisible}
        onOk={() => {
          const learnedList = newLearnedText.split(',').map((item) => item.trim()).filter(Boolean);
          const weakList = newWeakText.split(',').map((item) => item.trim()).filter(Boolean);
          onUpdateMemory?.(learnedList, weakList);
          setEditModalVisible(false);
        }}
        onCancel={() => {
          setEditModalVisible(false);
          setNewLearnedText(safeLearnedTopics.join(', '));
          setNewWeakText(safeWeakTopics.join(', '));
        }}
        okText="Save profiler"
        cancelText="Cancel"
      >
        <div className="learning-edit-form">
          <label>
            <span>Mastered concepts</span>
            <Input.TextArea
              rows={3}
              placeholder="Example: MVC Flow, JPA Repository, SQL Basics"
              value={newLearnedText}
              onChange={(event) => setNewLearnedText(event.target.value)}
            />
          </label>
          <label>
            <span>Focus areas</span>
            <Input.TextArea
              rows={3}
              placeholder="Example: Spring Security, OAuth2, Docker Deployment"
              value={newWeakText}
              onChange={(event) => setNewWeakText(event.target.value)}
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}

export default LearningProgress;
