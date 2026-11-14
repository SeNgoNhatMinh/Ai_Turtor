import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Progress, Row, Tag, Typography } from 'antd';
import { CheckCircle2, Database, RefreshCw, TriangleAlert } from 'lucide-react';
import PageHeader from '../../../components/common/PageHeader';
import SearchableTable from '../../../components/common/SearchableTable';
import { adminAcademicApi } from '../../../services/adminAcademicApi';
import { materialsApi } from '../../../services/materialsApi';
import { getUserFacingError } from '../../../services/apiClient';
import { queryKeys } from '../../../app/queryKeys';
import './AdminReindexPage.css';

const { Paragraph, Text } = Typography;
const getCourseId = (course = {}) => String(course.courseId || course.id || course.code || '').trim();
const getCourseName = (course = {}) => course.courseName || course.name || course.title || 'Chưa có tên môn';

function coursePercent(course) {
  if (!course) return 0;
  if (course.status === 'DONE' || course.status === 'FAILED') return 100;
  if (course.status === 'PROCESSING' || course.status === 'STOPPING') {
    return Math.max(0, Math.min(99, Number(course.percent) || 0));
  }
  if (course.status === 'CANCELLED') return Math.max(0, Math.min(100, Number(course.percent) || 0));
  return 0;
}

export default function AdminReindexPage({ triggerToast }) {
  const [run, setRun] = useState(null);
  const coursesQuery = useQuery({
    queryKey: queryKeys.adminCourses(),
    queryFn: ({ signal }) => adminAcademicApi.getCourses({ signal }),
    staleTime: 60_000,
  });
  const courses = (coursesQuery.data || []).filter((course) => getCourseId(course));
  const loading = coursesQuery.isPending || coursesQuery.isFetching;
  const error = coursesQuery.error
    ? getUserFacingError(coursesQuery.error, 'Không thể tải danh sách môn học.')
    : '';
  const loadCourses = () => coursesQuery.refetch();
  const running = run?.status === 'RUNNING' || run?.status === 'STOPPING';
  const courseRun = (courseId) => (run?.courses || []).find((item) => item.courseId === courseId);
  const processing = (run?.courses || []).find((item) => item.status === 'PROCESSING' || item.status === 'STOPPING');

  const summary = useMemo(() => {
    const values = courses.map((course) => (run?.courses || []).find((item) => item.courseId === getCourseId(course))).filter(Boolean);
    return {
      completed: values.filter((item) => item.status === 'DONE').length,
      failed: values.filter((item) => item.status === 'FAILED').length,
      processing: values.filter((item) => item.status === 'PROCESSING' || item.status === 'STOPPING').length,
    };
  }, [courses, run]);

  const progress = courses.length
    ? Math.round(courses.reduce((sum, course) => sum + coursePercent(courseRun(getCourseId(course))), 0) / courses.length)
    : 0;

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await materialsApi.currentReindexRun();
        if (!cancelled) setRun(next);
      } catch {
        // Keep the last server snapshot if a poll fails.
      }
    };
    tick();
    const timer = window.setInterval(tick, running ? 1500 : 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [running]);

  const runCourses = async (courseIds) => {
    try {
      setRun(await materialsApi.startReindexRun(courseIds));
    } catch (reason) {
      triggerToast?.(getUserFacingError(reason, 'Không thể bắt đầu reindex.'));
    }
  };

  const stopReindex = async () => {
    try {
      setRun(await materialsApi.stopReindexRun());
      triggerToast?.('Đã gửi lệnh dừng. Lô embedding đang chạy sẽ kết thúc rồi dừng.');
    } catch (reason) {
      triggerToast?.(getUserFacingError(reason, 'Không thể dừng reindex.'));
    }
  };

  const statusTag = (status) => {
    if (status === 'DONE') return <Tag color="success">Hoàn tất</Tag>;
    if (status === 'FAILED') return <Tag color="error">Thất bại</Tag>;
    if (status === 'CANCELLED') return <Tag color="warning">Đã dừng</Tag>;
    if (status === 'PROCESSING' || status === 'STOPPING') return <Tag color="processing">Đang xử lý</Tag>;
    if (status === 'WAITING') return <Tag>Đang chờ</Tag>;
    return <Tag color="blue">Sẵn sàng</Tag>;
  };

  return (
    <div className="portal-section admin-route-page admin-reindex-page">
      <PageHeader
        eyebrow="Quản trị dữ liệu AI"
        title="Reindex toàn bộ tài liệu"
        description="Tạo lại chỉ mục văn bản và hình ảnh cho học liệu đang có. Tài liệu gốc và API key không bị thay đổi."
        actions={<Button icon={<RefreshCw size={16} />} onClick={loadCourses}>Làm mới</Button>}
      />
      {error && <Alert type="error" showIcon title={error} />}
      <Card className="reindex-hero">
        <div className="reindex-hero__content">
          <div className="reindex-hero__icon"><Database size={30} /></div>
          <div>
            <h2>Cập nhật chỉ mục Hybrid Visual RAG</h2>
            <Paragraph>Reindex chạy trên máy chủ. Rời trang này không hủy tiến độ. Bấm Dừng để dừng thật sau lô embedding hiện tại.</Paragraph>
          </div>
          <div className="reindex-hero__actions">
            <Button type="primary" size="large" loading={running} disabled={loading || !courses.length || running} onClick={() => runCourses(courses.map(getCourseId))}>
              {running ? 'Đang reindex...' : 'Reindex tất cả tài liệu'}
            </Button>
            {running && <Button danger size="large" onClick={stopReindex}>Dừng</Button>}
          </div>
        </div>
        <Progress percent={progress} status={summary.failed ? 'exception' : running ? 'active' : 'normal'} />
        {processing && (
          <div className="reindex-live">
            <div className="reindex-live__percent">{coursePercent(processing)}%</div>
            <div>
              <strong>{processing.stageLabel || 'Đang reindex'}</strong>
              <p>{processing.courseId}{' · '}{processing.message || 'Đang bắt đầu...'}</p>
            </div>
          </div>
        )}
      </Card>
      <Row gutter={[16, 16]} className="reindex-stats">
        <Col xs={12} lg={6}><Card><Text type="secondary">Tổng số môn</Text><strong>{courses.length}</strong></Card></Col>
        <Col xs={12} lg={6}><Card><Text type="secondary">Đã hoàn tất</Text><strong className="success"><CheckCircle2 size={18} />{summary.completed}</strong></Card></Col>
        <Col xs={12} lg={6}><Card><Text type="secondary">Đang xử lý</Text><strong>{summary.processing}</strong></Card></Col>
        <Col xs={12} lg={6}><Card><Text type="secondary">Thất bại</Text><strong className="danger"><TriangleAlert size={18} />{summary.failed}</strong></Card></Col>
      </Row>
      <Card className="reindex-progress-card" title="Tiến trình theo môn học">
        <SearchableTable
          rowKey={getCourseId}
          loading={loading}
          dataSource={courses}
          pagination={false}
          sticky={false}
          scroll={{ x: 1040, y: 480 }}
          columns={[
            { title: 'Mã môn', key: 'courseId', width: 120, ellipsis: true, render: (_, row) => <Text strong>{getCourseId(row)}</Text> },
            { title: 'Tên môn học', key: 'name', ellipsis: true, render: (_, row) => getCourseName(row) },
            { title: 'Trạng thái', key: 'status', width: 130, render: (_, row) => statusTag(courseRun(getCourseId(row))?.status) },
            {
              title: 'Tiến độ',
              key: 'percent',
              width: 150,
              render: (_, row) => {
                const item = courseRun(getCourseId(row));
                const status = item?.status;
                return (
                  <Progress
                    percent={coursePercent(item)}
                    size="small"
                    status={status === 'FAILED' ? 'exception' : status === 'PROCESSING' || status === 'STOPPING' ? 'active' : undefined}
                  />
                );
              },
            },
            {
              title: 'Chi tiết',
              key: 'message',
              ellipsis: true,
              render: (_, row) => courseRun(getCourseId(row))?.message || '—',
            },
            {
              title: 'Thao tác',
              key: 'action',
              width: 170,
              fixed: 'right',
              render: (_, row) => {
                const item = courseRun(getCourseId(row));
                const activeRow = item?.status === 'PROCESSING' || item?.status === 'STOPPING';
                return (
                  <Button
                    icon={<RefreshCw size={14} />}
                    disabled={running && !activeRow}
                    onClick={() => (activeRow ? stopReindex() : runCourses([getCourseId(row)]))}
                  >
                    {activeRow ? 'Dừng' : 'Reindex môn này'}
                  </Button>
                );
              },
            },
          ]}
        />
      </Card>
      <Alert className="reindex-note" type="info" showIcon title="Không cần upload lại tài liệu" description="Reindex chỉ tạo lại vector tìm kiếm từ học liệu đang lưu trong MongoDB/GridFS; không xóa file, tài khoản hay cấu hình API." />
    </div>
  );
}
