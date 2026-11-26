import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Input, Table, Tag } from 'antd';
import { Download, MessageSquareText, RefreshCw, Smile, Star, ThumbsUp } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import MetricStrip from '../../components/common/MetricStrip';
import { feedbackApi } from '../../services/feedbackApi';
import { getUserFacingError } from '../../services/apiClient';
import { DEVICE_OPTIONS, FEATURE_OPTIONS, RATING_QUESTIONS, labelOf } from './feedbackOptions';
import './Feedback.css';

const fmt = (value, digits = 1) => (value == null ? '—' : Number(value).toFixed(digits));

function Bars({ title, rows, total }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <section className="feedback-bars" aria-label={title}>
      <h3>{title}</h3>
      {rows.map((row) => (
        <div className="feedback-bars__row" key={row.label}>
          <span className="feedback-bars__label">{row.label}</span>
          <span className="feedback-bars__track">
            <span className="feedback-bars__fill" style={{ width: `${(row.count / max) * 100}%` }} />
          </span>
          <span className="feedback-bars__value">
            {row.count}{total ? ` · ${Math.round((row.count / total) * 100)}%` : ''}
          </span>
        </div>
      ))}
    </section>
  );
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportCsv(items) {
  const header = ['Thời gian', 'Email', 'Môn', 'Lớp', ...RATING_QUESTIONS.map((q) => q.label), 'Giới thiệu (0-10)',
    'Thiết bị', 'Tính năng đã dùng', 'Gặp lỗi', 'Mô tả lỗi', 'Thích nhất', 'Cần cải thiện'];
  const lines = items.map((item) => [
    item.updatedAt, item.email, item.courseId, item.classId, ...RATING_QUESTIONS.map((q) => item[q.key]), item.recommend,
    labelOf(DEVICE_OPTIONS, item.device), (item.featuresUsed || []).map((f) => labelOf(FEATURE_OPTIONS, f)).join('; '),
    item.hadIssues ? 'Có' : 'Không', item.issueDetail, item.liked, item.improve,
  ].map(csvCell).join(','));
  // BOM so Excel opens the Vietnamese text as UTF-8.
  const blob = new Blob(['﻿' + [header.map(csvCell).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `gop-y-trai-nghiem-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function AdminFeedbackPage() {
  const [search, setSearch] = useState('');
  const summaryQuery = useQuery({
    queryKey: ['admin', 'feedback'],
    queryFn: ({ signal }) => feedbackApi.getSummary({ signal }),
    refetchInterval: 60_000,
  });
  const data = summaryQuery.data || {};
  const items = useMemo(() => data.items || [], [data.items]);
  const count = data.count || 0;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => [item.email, item.courseId, item.classId, item.issueDetail, item.liked, item.improve]
      .some((value) => String(value || '').toLowerCase().includes(q)));
  }, [items, search]);

  const columns = [
    { title: 'Email', dataIndex: 'email', key: 'email', width: 200, ellipsis: true },
    { title: 'Lớp', key: 'class', width: 140, render: (_, item) => [item.courseId, item.classId].filter(Boolean).join(' / ') || '—' },
    ...RATING_QUESTIONS.map((q) => ({
      title: q.label.replace('Mức độ hài lòng chung với AI Tutor', 'Hài lòng').replace('Câu trả lời của AI đúng và dễ hiểu', 'AI').replace('Tốc độ AI trả lời', 'Tốc độ').replace('Giao diện dễ sử dụng', 'Dễ dùng'),
      dataIndex: q.key,
      key: q.key,
      width: 80,
      align: 'center',
      sorter: (a, b) => (a[q.key] || 0) - (b[q.key] || 0),
    })),
    { title: 'Giới thiệu', dataIndex: 'recommend', key: 'recommend', width: 90, align: 'center', sorter: (a, b) => (a.recommend || 0) - (b.recommend || 0) },
    {
      title: 'Lỗi',
      key: 'issues',
      width: 70,
      render: (_, item) => (item.hadIssues ? <Tag color="red">Có</Tag> : <Tag>Không</Tag>),
      filters: [{ text: 'Có lỗi', value: true }, { text: 'Không', value: false }],
      onFilter: (value, item) => Boolean(item.hadIssues) === value,
    },
    { title: 'Gửi lúc', dataIndex: 'updatedAt', key: 'updatedAt', width: 150, render: (value) => (value ? new Date(value).toLocaleString('vi-VN') : '—') },
  ];

  return (
    <div className="feedback-admin-page">
      <PageHeader
        eyebrow="Khảo sát"
        title="Góp ý trải nghiệm"
        description="Câu trả lời khảo sát của người dùng trong đợt test. Tự cập nhật mỗi phút."
        actions={(
          <>
            <Button icon={<RefreshCw size={15} />} onClick={() => summaryQuery.refetch()} loading={summaryQuery.isFetching}>Làm mới</Button>
            <Button icon={<Download size={15} />} onClick={() => exportCsv(items)} disabled={!items.length}>Xuất CSV</Button>
          </>
        )}
      />

      {summaryQuery.error && (
        <Alert type="error" showIcon message={getUserFacingError(summaryQuery.error, 'Không tải được kết quả khảo sát.')} />
      )}

      <MetricStrip
        ariaLabel="Tổng quan khảo sát"
        items={[
          { key: 'count', label: 'Lượt trả lời', value: count, icon: MessageSquareText },
          { key: 'overall', label: 'Hài lòng chung (/5)', value: fmt(data.averages?.overall), icon: Smile },
          { key: 'ai', label: 'Chất lượng AI (/5)', value: fmt(data.averages?.aiQuality), icon: Star },
          { key: 'nps', label: 'NPS (−100 đến 100)', value: data.nps ?? '—', description: '% điểm 9–10 trừ % điểm 0–6', icon: ThumbsUp },
        ]}
      />

      {count === 0 && !summaryQuery.isPending ? (
        <Alert type="info" showIcon message="Chưa có góp ý nào" description="Sinh viên mở mục Góp ý trải nghiệm trong menu để trả lời; kết quả hiện ở đây." />
      ) : (
        <div className="feedback-admin-grid">
          <Bars
            title="Điểm trung bình từng tiêu chí (/5)"
            rows={RATING_QUESTIONS.map((q) => ({ label: q.label, count: Number(fmt(data.averages?.[q.key], 2)) || 0 }))}
          />
          <Bars
            title="Tính năng đã dùng"
            total={count}
            rows={FEATURE_OPTIONS.map((f) => ({ label: f.label, count: data.features?.[f.value] || 0 }))}
          />
          <Bars
            title="Thiết bị"
            total={count}
            rows={DEVICE_OPTIONS.map((d) => ({ label: d.label, count: data.devices?.[d.value] || 0 }))}
          />
          <Bars title="Gặp lỗi" total={count} rows={[{ label: 'Có gặp lỗi', count: data.issueCount || 0 }]} />
        </div>
      )}

      <Input.Search
        id="feedback-search"
        allowClear
        placeholder="Tìm theo email, lớp hoặc nội dung góp ý"
        aria-label="Tìm góp ý"
        onChange={(event) => setSearch(event.target.value)}
        className="feedback-admin-search"
      />
      <Table
        rowKey="userId"
        size="small"
        loading={summaryQuery.isPending}
        dataSource={filtered}
        columns={columns}
        scroll={{ x: 1000 }}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        expandable={{
          rowExpandable: (item) => Boolean(item.issueDetail || item.liked || item.improve || item.featuresUsed?.length),
          expandedRowRender: (item) => (
            <dl className="feedback-detail">
              {item.device && (<><dt>Thiết bị</dt><dd>{labelOf(DEVICE_OPTIONS, item.device)}</dd></>)}
              {item.featuresUsed?.length > 0 && (<><dt>Tính năng</dt><dd>{item.featuresUsed.map((f) => labelOf(FEATURE_OPTIONS, f)).join(', ')}</dd></>)}
              {item.issueDetail && (<><dt>Lỗi gặp phải</dt><dd>{item.issueDetail}</dd></>)}
              {item.liked && (<><dt>Thích nhất</dt><dd>{item.liked}</dd></>)}
              {item.improve && (<><dt>Cần cải thiện</dt><dd>{item.improve}</dd></>)}
            </dl>
          ),
        }}
      />
    </div>
  );
}
