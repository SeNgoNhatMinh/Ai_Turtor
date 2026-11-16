import { Tag, Tooltip } from 'antd';
import { BEHAVIOR_SCOPE_COLORS, BEHAVIOR_SCOPE_LABELS, domainLabel } from './behaviorConstants';

export function BehaviorScopeTag({ behavior }) {
  const detail = behavior.scope === 'COURSE' || behavior.scope === 'STUDENT' ? behavior.courseId
    : behavior.scope === 'DOMAIN' ? domainLabel(behavior.domain) : '';
  return (
    <Tag color={BEHAVIOR_SCOPE_COLORS[behavior.scope]}>
      {BEHAVIOR_SCOPE_LABELS[behavior.scope] || behavior.scope}{detail ? ` · ${detail}` : ''}
    </Tag>
  );
}

export function BehaviorStats({ behavior }) {
  const rate = Math.round((Number(behavior.successRate) || 0) * 100);
  return (
    <Tooltip title={`${behavior.outcomeCount || 0} lần được AI chấm hiệu quả sau đánh giá định kỳ`}>
      <span className="teaching-behavior-usage">
        Dùng {behavior.useCount || 0} lần
        <span>·</span>
        {behavior.outcomeCount ? `Hiệu quả ${rate}%` : 'Chưa đủ dữ liệu'}
      </span>
    </Tooltip>
  );
}
