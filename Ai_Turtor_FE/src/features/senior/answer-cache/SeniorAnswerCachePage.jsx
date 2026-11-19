import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Select, Space, Statistic, Table, Tag } from 'antd';
import { RefreshCw } from 'lucide-react';
import PageHeader from '../../../components/common/PageHeader';
import { getUserFacingError } from '../../../services/apiClient';
import { chapterMemoryApi } from '../../../services/chapterMemoryApi';
import { useAnswerCacheScope } from '../../answer-cache/hooks/useAnswerCacheScope';
import '../../answer-cache/AnswerCachePage.css';

function formatCount(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value) || 0);
}

export default function SeniorAnswerCachePage({ courseId, setCourseId, triggerToast }) {
  const scope = useAnswerCacheScope({ courseId, setCourseId });
  const queryClient = useQueryClient();
  const [reloading, setReloading] = useState(false);
  const normalizedCourseId = String(courseId || '').trim();
  const memoryQuery = useQuery({
    queryKey: ['senior', 'chapter-memory', normalizedCourseId],
    queryFn: () => chapterMemoryApi.snapshot(normalizedCourseId),
    enabled: Boolean(normalizedCourseId),
    staleTime: 15_000,
  });
  const memory = memoryQuery.data || null;
  const chapters = Array.isArray(memory?.chapters) ? memory.chapters : [];

  const reload = async () => {
    if (!normalizedCourseId || reloading) return;
    setReloading(true);
    try {
      const next = await chapterMemoryApi.reload(normalizedCourseId);
      queryClient.setQueryData(['senior', 'chapter-memory', normalizedCourseId], next);
      triggerToast?.(`Đã nạp ${formatCount(next?.chapterCount)} chương vào RAM.`, 'success');
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không nạp lại được chương vào RAM.'), 'error');
    } finally {
      setReloading(false);
    }
  };

  return (
    <div className="portal-section answer-cache-page">
      <PageHeader
        eyebrow="Kiểm duyệt chuyên môn"
        title="Cache chương trong RAM"
        description="Backend giữ đoạn chương đã index trong bộ nhớ dùng chung. Câu hỏi khớp tên chương lấy đúng đoạn đó, không embed lại câu hỏi để tìm chương."
      />

      {scope.coursesError && (
        <Alert className="answer-cache-alert" type="warning" showIcon title={scope.coursesError} />
      )}
      {memoryQuery.error && (
        <Alert
          className="answer-cache-alert"
          type="error"
          showIcon
          title={getUserFacingError(memoryQuery.error, 'Không đọc được cache chương trong RAM.')}
        />
      )}

      <Card className="answer-cache-filters">
        <Space wrap>
          <Select
            showSearch
            placeholder="Chọn môn học"
            style={{ minWidth: 280 }}
            loading={scope.loadingCourses}
            value={normalizedCourseId || undefined}
            options={scope.courseOptions}
            onChange={setCourseId}
          />
          <Button icon={<RefreshCw size={15} />} loading={reloading} disabled={!normalizedCourseId} onClick={reload}>
            Nạp lại từ chunk đã index
          </Button>
        </Space>
      </Card>

      {normalizedCourseId && memoryQuery.isPending && (
        <Alert className="answer-cache-alert" type="info" showIcon title="Đang đọc chương đang nằm trong RAM..." />
      )}

      {normalizedCourseId && memory && (
        <>
          <Alert
            className="answer-cache-alert"
            type={memory.loaded ? 'success' : 'info'}
            showIcon
            title={memory.loaded
              ? `${memory.courseId} đang có ${formatCount(memory.chapterCount)} chương trong RAM.`
              : `${memory.courseId} chưa được nạp vào RAM. RAM được nạp khi index tài liệu, khi API khởi động, hoặc khi sinh viên mở chat môn này.`}
            description={`Mỗi chương giữ tối đa ${formatCount(memory.excerptLimit)} ký tự từ chunk đã lưu trong Elasticsearch. Đây là đoạn nguồn để soạn câu trả lời, không phải câu trả lời đã viết sẵn.`}
          />
          <Card className="answer-cache-stats">
            <Space size={32} wrap>
              <Statistic title="Trạng thái" value={memory.loaded ? 'Đang trong RAM' : 'Chưa nạp'} />
              <Statistic title="Chương" value={formatCount(memory.chapterCount)} />
              <Statistic title="Ký tự" value={formatCount(memory.characters)} />
              <Statistic title="Giới hạn mỗi chương" value={formatCount(memory.excerptLimit)} />
            </Space>
          </Card>
          <Card className="answer-cache-table-card" title="Đoạn chương trong RAM">
            <Table
              rowKey="chapterKey"
              loading={memoryQuery.isPending}
              dataSource={chapters}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              locale={{ emptyText: 'RAM của môn này chưa có chương nào.' }}
              expandable={{
                expandedRowRender: (chapter) => (
                  <pre className="answer-cache-preview" style={{ whiteSpace: 'pre-wrap', padding: 16, margin: 0 }}>
                    {chapter.text || 'Chưa có đoạn chữ.'}
                  </pre>
                ),
              }}
              columns={[
                {
                  title: 'Chương',
                  dataIndex: 'title',
                  render: (title, chapter) => (
                    <Space orientation="vertical" size={0}>
                      <strong>{title || chapter.chapterKey}</strong>
                      <span>{chapter.chapterKey}</span>
                    </Space>
                  ),
                },
                {
                  title: 'Ký tự',
                  dataIndex: 'characters',
                  width: 120,
                  render: (value) => formatCount(value),
                },
                {
                  title: 'Nguồn',
                  dataIndex: 'materialId',
                  width: 180,
                  render: (value) => (value ? <Tag>{value}</Tag> : '—'),
                },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  );
}
