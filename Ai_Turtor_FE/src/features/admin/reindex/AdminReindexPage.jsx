import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Progress, Row, Tag, Typography } from 'antd';
import { CheckCircle2, Database, RefreshCw, TriangleAlert } from 'lucide-react';
import PageHeader from '../../../components/common/PageHeader';
import SearchableTable from '../../../components/common/SearchableTable';
import { adminAcademicApi } from '../../../services/adminAcademicApi';
import { materialsApi } from '../../../services/materialsApi';
import { getUserFacingError } from '../../../services/apiClient';
import './AdminReindexPage.css';

const { Paragraph, Text } = Typography;
const getCourseId = (course = {}) => String(course.courseId || course.id || course.code || '').trim();
const getCourseName = (course = {}) => course.courseName || course.name || course.title || 'Chưa có tên môn';

export default function AdminReindexPage({ triggerToast }) {
  const [courses, setCourses] = useState([]);
  const [states, setStates] = useState({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminAcademicApi.getCourses();
      const validCourses = data.filter((course) => getCourseId(course));
      setCourses(validCourses);
      setStates(Object.fromEntries(validCourses.map((course) => [getCourseId(course), { status: 'READY' }])));
    } catch (reason) {
      setError(getUserFacingError(reason, 'Không thể tải danh sách môn học.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCourses(); }, [loadCourses]);

  const summary = useMemo(() => {
    const values = Object.values(states);
    return {
      completed: values.filter((item) => item.status === 'DONE').length,
      failed: values.filter((item) => item.status === 'FAILED').length,
      processing: values.filter((item) => item.status === 'PROCESSING').length,
    };
  }, [states]);

  const progress = courses.length ? Math.round(((summary.completed + summary.failed) / courses.length) * 100) : 0;

  const reindexCourse = async (course) => {
    const courseId = getCourseId(course);
    setStates((previous) => ({ ...previous, [courseId]: { status: 'PROCESSING' } }));
    try {
      const result = await materialsApi.reindexCourseMaterials(courseId);
      setStates((previous) => ({ ...previous, [courseId]: { status: 'DONE', result } }));
      return true;
    } catch (reason) {
      setStates((previous) => ({
        ...previous,
        [courseId]: { status: 'FAILED', message: getUserFacingError(reason, 'Reindex thất bại.') },
      }));
      return false;
    }
  };

  const runSingleCourse = async (course) => {
    if (running) return;
    setRunning(true);
    setError('');
    const success = await reindexCourse(course);
    setRunning(false);
    triggerToast?.(success
      ? `Đã reindex môn ${getCourseId(course)} thành công.`
      : `Không thể reindex môn ${getCourseId(course)}.`);
  };

  const runReindex = async () => {
    if (running || !courses.length) return;
    setRunning(true);
    setError('');
    setStates(Object.fromEntries(courses.map((course) => [getCourseId(course), { status: 'WAITING' }])));
    let failedCount = 0;

    for (const course of courses) {
      const success = await reindexCourse(course);
      if (!success) failedCount += 1;
    }

    setRunning(false);
    triggerToast?.(failedCount ? `Hoàn tất với ${failedCount} môn bị lỗi.` : 'Đã reindex toàn bộ tài liệu thành công.');
  };

  const statusTag = (status) => {
    if (status === 'DONE') return <Tag color="success">Hoàn tất</Tag>;
    if (status === 'FAILED') return <Tag color="error">Thất bại</Tag>;
    if (status === 'PROCESSING') return <Tag color="processing">Đang xử lý</Tag>;
    if (status === 'WAITING') return <Tag>Đang chờ</Tag>;
    return <Tag color="blue">Sẵn sàng</Tag>;
  };

  return (
    <div className="portal-section admin-route-page admin-reindex-page">
      <PageHeader
        eyebrow="Quản trị dữ liệu AI"
        title="Reindex toàn bộ tài liệu"
        description="Tạo lại chỉ mục văn bản và hình ảnh cho học liệu đang có. Tài liệu gốc và API key không bị thay đổi."
        actions={<Button icon={<RefreshCw size={16} />} onClick={loadCourses} disabled={running}>Làm mới</Button>}
      />
      {error && <Alert type="error" showIcon title={error} />}
      <Card className="reindex-hero">
        <div className="reindex-hero__content">
          <div className="reindex-hero__icon"><Database size={30} /></div>
          <div>
            <h2>Cập nhật chỉ mục Hybrid Visual RAG</h2>
            <Paragraph>Chế độ tự động xử lý lần lượt từng môn, không chạy song song, nhằm hạn chế quá tải embedding API và tiêu hao token quá nhanh.</Paragraph>
          </div>
          <Button type="primary" size="large" loading={running} disabled={loading || !courses.length} onClick={runReindex}>
            {running ? 'Đang reindex...' : 'Reindex tất cả tài liệu'}
          </Button>
        </div>
        <Progress percent={progress} status={summary.failed ? 'exception' : running ? 'active' : 'normal'} />
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
          scroll={{ x: 880, y: 480 }}
          columns={[
            { title: 'Mã môn', key: 'courseId', width: 120, ellipsis: true, render: (_, row) => <Text strong>{getCourseId(row)}</Text> },
            { title: 'Tên môn học', key: 'name', ellipsis: true, render: (_, row) => getCourseName(row) },
            { title: 'Trạng thái', key: 'status', width: 130, render: (_, row) => statusTag(states[getCourseId(row)]?.status) },
            {
              title: 'Chi tiết',
              key: 'message',
              ellipsis: true,
              render: (_, row) => states[getCourseId(row)]?.message || '—',
            },
            {
              title: 'Thao tác',
              key: 'action',
              width: 170,
              fixed: 'right',
              render: (_, row) => (
                <Button
                  icon={<RefreshCw size={14} />}
                  loading={states[getCourseId(row)]?.status === 'PROCESSING'}
                  disabled={running && states[getCourseId(row)]?.status !== 'PROCESSING'}
                  onClick={() => runSingleCourse(row)}
                >
                  Reindex môn này
                </Button>
              ),
            },
          ]}
        />
      </Card>
      <Alert className="reindex-note" type="info" showIcon title="Không cần upload lại tài liệu" description="Reindex chỉ tạo lại vector tìm kiếm từ học liệu đang lưu trong MongoDB/GridFS; không xóa file, tài khoản hay cấu hình API." />
    </div>
  );
}
