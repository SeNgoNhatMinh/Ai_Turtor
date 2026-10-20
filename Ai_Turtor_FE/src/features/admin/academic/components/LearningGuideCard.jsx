import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Space, Tag } from 'antd';
import { BookOpenCheck, Check, RefreshCw, X } from 'lucide-react';
import { adminAcademicApi } from '../../../../services/adminAcademicApi';

const STATUS_META = {
  APPROVED: { color: 'green', label: 'Đã duyệt · đang hiển thị cho sinh viên' },
  PENDING_REVIEW: { color: 'orange', label: 'Chờ duyệt · sinh viên vẫn thấy bản duyệt trước/parser' },
  REJECTED: { color: 'red', label: 'Đã từ chối' },
  FAILED: { color: 'red', label: 'Trích xuất lỗi' },
  NONE: { color: 'default', label: 'Chưa tạo' },
  NO_SYLLABUS: { color: 'default', label: 'Môn chưa có syllabus' },
};

function LearningGuideCard({ courseId }) {
  const [guide, setGuide] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!courseId) {
      setGuide(null);
      return;
    }
    try {
      setError('');
      setGuide(await adminAcademicApi.getLearningGuide(courseId));
    } catch (loadError) {
      setError(loadError?.message || 'Không tải được hướng dẫn học tập.');
    }
  }, [courseId]);

  useEffect(() => {
    let cancelled = false;
    if (!courseId) return undefined;

    adminAcademicApi.getLearningGuide(courseId)
      .then((nextGuide) => {
        if (cancelled) return;
        setError('');
        setGuide(nextGuide);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError?.message || 'Không tải được hướng dẫn học tập.');
      });

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const run = async (action) => {
    setBusy(true);
    try {
      setError('');
      setGuide(await action(courseId));
    } catch (actionError) {
      setError(actionError?.message || 'Thao tác thất bại.');
    } finally {
      setBusy(false);
    }
  };

  if (!courseId) return null;

  const status = guide?.status || 'NONE';
  const meta = STATUS_META[status] || STATUS_META.NONE;
  const topics = guide?.topics || [];
  const warnings = guide?.validationWarnings || [];

  return (
    <Card
      title="Hướng dẫn học tập (AI trích xuất từ syllabus)"
      size="small"
      style={{ marginBottom: 16 }}
      extra={<Tag color={meta.color}>{meta.label}</Tag>}
    >
      <Space orientation="vertical" size={10} style={{ width: '100%' }}>
        {error && <Alert type="error" showIcon title={error} />}
        {!guide || status === 'NONE' ? (
          <span>Chưa có bản trích xuất. Bản hướng dẫn được tạo tự động khi lưu syllabus, hoặc bấm “Tạo lại”.</span>
        ) : (
          <>
            {guide.syllabusVersion && (
              <span>Phiên bản syllabus: <code>{guide.syllabusVersion}</code></span>
            )}
            {guide.overview && <span>{guide.overview}</span>}
            {guide.errorMessage && <Alert type="error" showIcon title={guide.errorMessage} />}
            {warnings.length > 0 && (
              <Alert
                type="warning"
                showIcon
                title={`${warnings.length} cảnh báo kiểm chứng`}
                description={warnings.join(' · ')}
              />
            )}
            {topics.length > 0 && (
              <Space size={[6, 6]} wrap>
                {topics.map((topic) => (
                  <Tag key={topic.title} icon={<BookOpenCheck size={12} />}>{topic.title}</Tag>
                ))}
              </Space>
            )}
            {(guide.keywords || []).length > 0 && (
              <Space size={[6, 6]} wrap>
                {guide.keywords.map((keyword) => <Tag key={keyword} color="blue">{keyword}</Tag>)}
              </Space>
            )}
            <span>
              Mục tiêu kiến thức: {guide.knowledgeObjectives?.length || 0} ·
              {' '}Kỹ năng: {guide.skillObjectives?.length || 0}
            </span>
          </>
        )}
        <Space wrap>
          <Button
            size="small"
            icon={<RefreshCw size={14} />}
            loading={busy}
            onClick={() => run(adminAcademicApi.regenerateLearningGuide)}
          >
            Tạo lại
          </Button>
          {status === 'PENDING_REVIEW' && (
            <>
              <Button
                size="small"
                type="primary"
                icon={<Check size={14} />}
                loading={busy}
                onClick={() => run(adminAcademicApi.approveLearningGuide)}
              >
                Duyệt công khai
              </Button>
              <Button
                size="small"
                danger
                icon={<X size={14} />}
                loading={busy}
                onClick={() => run(adminAcademicApi.rejectLearningGuide)}
              >
                Từ chối
              </Button>
            </>
          )}
          <Button size="small" onClick={load} disabled={busy}>Làm mới</Button>
        </Space>
      </Space>
    </Card>
  );
}

export default LearningGuideCard;
