import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Lightbulb, RefreshCw, Target } from 'lucide-react';
import { teacherApi } from '../../services/teacherApi';
import { getUserFacingError } from '../../services/apiClient';
import { asArray } from '../../services/normalizers';
import { HEATMAP_CLASS } from '../../features/teacher/shared/teacherUtils';
import { getPersonDisplayName } from '../../utils/displayNames';

const normalizeGapLevel = (level) => {
  const normalized = String(level || '').toLowerCase();
  if (['high', 'risk', 'critical', 'weak'].includes(normalized)) return 'high';
  if (['medium', 'med', 'warning', 'attention'].includes(normalized)) return 'medium';
  if (['none', 'strong', 'healthy'].includes(normalized)) return 'strong';
  return 'low';
};

const getTopicLabel = (node) => node?.label || node?.topic || node?.name || 'Chủ đề chưa đặt tên';

const getTopicDescription = (level) => {
  if (level === 'high') return 'Nhiều sinh viên đang gặp khó khăn. Cần ôn lại chủ đề này trước.';
  if (level === 'medium') return 'Có tín hiệu cần lưu ý. Nên bổ sung bài luyện tập hoặc ví dụ.';
  if (level === 'strong') return 'Sinh viên đang học ổn định. Tiếp tục theo dõi.';
  return 'Chưa đủ dữ liệu. Kiểm tra lại sau khi có thêm hoạt động học tập.';
};

function TeacherClassesTab({
  courseId,
  classId,
  setClassId,
  classesList = [],
  teacherStudents = [],
  teacherDashboardLoading,
  loadTeacherDashboard,
  heatmapNodes = [],
  triggerToast,
}) {
  const [courseMemories, setCourseMemories] = useState([]);
  const [courseMemoriesLoading, setCourseMemoriesLoading] = useState(false);

  useEffect(() => {
    if (!courseId) {
      const resetTimer = window.setTimeout(() => setCourseMemories([]), 0);
      return () => window.clearTimeout(resetTimer);
    }

    let cancelled = false;
    const loadCourseMemories = async () => {
      setCourseMemoriesLoading(true);
      try {
        const data = await teacherApi.getCourseMemories(courseId, classId);
        if (!cancelled) {
          setCourseMemories(asArray(data, 'memories', 'content', 'items'));
        }
      } catch (error) {
        if (!cancelled) {
          setCourseMemories([]);
          triggerToast?.(getUserFacingError(error, 'Không thể tải tín hiệu bộ nhớ học tập của môn.'));
        }
      } finally {
        if (!cancelled) setCourseMemoriesLoading(false);
      }
    };

    loadCourseMemories();
    return () => {
      cancelled = true;
    };
  }, [classId, courseId, triggerToast]);

  const currentClass = classesList.find((item) => item.classCode === classId || item.classId === classId || item.id === classId);
  const normalizedHeatmap = heatmapNodes.map((node) => ({
    ...node,
    label: getTopicLabel(node),
    normalizedLevel: normalizeGapLevel(node.level),
  }));
  const highRiskTopics = normalizedHeatmap.filter((node) => node.normalizedLevel === 'high');
  const attentionTopics = normalizedHeatmap.filter((node) => node.normalizedLevel === 'medium');
  const strongTopics = normalizedHeatmap.filter((node) => node.normalizedLevel === 'strong');
  const otherTopics = normalizedHeatmap.filter((node) => node.normalizedLevel === 'low');
  const hasHeatmapData = normalizedHeatmap.length > 0;
  const memoryStats = useMemo(() => {
    const learned = new Set();
    const weak = new Set();
    let latest = '';
    courseMemories.forEach((memory) => {
      asArray(memory?.learnedTopics || memory?.strongTopics).forEach((topic) => learned.add(String(topic)));
      asArray(memory?.weakTopics || memory?.weakAreas).forEach((topic) => weak.add(String(topic)));
      const updatedAt = memory?.updatedAt || memory?.lastUpdatedAt || memory?.createdAt;
      if (updatedAt && (!latest || new Date(updatedAt) > new Date(latest))) {
        latest = updatedAt;
      }
    });
    return {
      memoryCount: courseMemories.length,
      learnedCount: learned.size,
      weakCount: weak.size,
      latest,
    };
  }, [courseMemories]);

  const renderTopicCard = (node, i) => (
    <div
      key={`${node.label}-${node.normalizedLevel}-${i}`}
      className={`heatmap-topic-card ${HEATMAP_CLASS[node.level] || HEATMAP_CLASS[node.normalizedLevel] || 'val-low'}`}
      title={getTopicDescription(node.normalizedLevel)}
    >
      <span className="heatmap-topic-name">{node.label}</span>
      <span className="heatmap-topic-hint">{getTopicDescription(node.normalizedLevel)}</span>
    </div>
  );

  return (
    <div className="grid-2x2 portal-view">
      <div className="glass-card">
        <div className="card-header">
          <h3>Danh sách lớp được phân công</h3>
          <button
            type="button"
            className="btn-small-chat"
            onClick={loadTeacherDashboard}
            disabled={teacherDashboardLoading || !loadTeacherDashboard}
            aria-label="Làm mới lớp được phân công và tín hiệu học tập"
          >
            <RefreshCw style={{ width: 12, height: 12 }} /> Làm mới
          </button>
        </div>
        {teacherDashboardLoading ? (
          <p className="no-data-text">Đang tải dữ liệu lớp...</p>
        ) : classesList.length === 0 ? (
          <p className="no-data-text">Tài khoản chưa được phân công lớp học phần.</p>
        ) : (
          <div className="teacher-classes-list">
            {classesList.map((c, i) => {
              const classValue = c.classCode || c.classId || c.id;
              return (
                <button
                  type="button"
                  key={classValue || i}
                  className={`class-card-item ${classId === classValue ? 'active-class' : ''}`}
                  onClick={() => setClassId(classValue)}
                  disabled={!classValue || !setClassId}
                  aria-pressed={classId === classValue}
                >
                  <span className="badge-semester">Học kỳ: {c.semester}</span>
                  <h4>{c.name}</h4>
                  <p>{c.details}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="glass-card">
        <div className="card-header">
          <div>
            <h3>Chủ đề cần hỗ trợ của lớp</h3>
            <span className="card-subtitle">
              {currentClass?.name || `Lớp ${classId}`} · tổng hợp từ bộ nhớ học tập, bài nộp và kết quả quiz
            </span>
          </div>
        </div>

        <div className="teacher-gap-summary">
          <div className="teacher-gap-metric teacher-gap-metric--risk">
            <AlertTriangle size={16} />
            <div>
              <strong>{highRiskTopics.length}</strong>
              <span>Cần ưu tiên</span>
            </div>
          </div>
          <div className="teacher-gap-metric teacher-gap-metric--attention">
            <Lightbulb size={16} />
            <div>
              <strong>{attentionTopics.length}</strong>
              <span>Cần theo dõi</span>
            </div>
          </div>
          <div className="teacher-gap-metric teacher-gap-metric--strong">
            <CheckCircle2 size={16} />
            <div>
              <strong>{strongTopics.length}</strong>
              <span>Ổn định</span>
            </div>
          </div>
        </div>

        <div className="teacher-course-memory-strip">
          <div>
            <strong>{courseMemoriesLoading ? '...' : memoryStats.memoryCount}</strong>
            <span>Bản ghi bộ nhớ</span>
          </div>
          <div>
            <strong>{courseMemoriesLoading ? '...' : memoryStats.learnedCount}</strong>
            <span>Chủ đề đã nắm</span>
          </div>
          <div>
            <strong>{courseMemoriesLoading ? '...' : memoryStats.weakCount}</strong>
            <span>Chủ đề còn yếu</span>
          </div>
          <div>
            <strong>{memoryStats.latest ? new Date(memoryStats.latest).toLocaleDateString('vi-VN') : '—'}</strong>
            <span>Cập nhật gần nhất</span>
          </div>
        </div>

        <div className="heatmap-container heatmap-container--teacher">
          {!hasHeatmapData ? (
            <div className="teacher-gap-empty">
              <Target size={22} />
              <strong>Chưa đủ dữ liệu để xác định chủ đề yếu</strong>
              <span>Khi sinh viên hỏi AI Tutor, nộp bài hoặc hoàn thành quiz, hệ thống sẽ tổng hợp các chủ đề cần hỗ trợ tại đây.</span>
            </div>
          ) : (
            <>
              <div className="teacher-gap-columns">
                <section className="teacher-gap-column teacher-gap-column--risk">
                  <div className="teacher-gap-column-header">
                    <AlertTriangle size={15} />
                    <span>Ôn lại trước</span>
                  </div>
                  {highRiskTopics.length ? highRiskTopics.map(renderTopicCard) : <p className="teacher-gap-placeholder">Hiện không có chủ đề cần ưu tiên cao.</p>}
                </section>

                <section className="teacher-gap-column teacher-gap-column--attention">
                  <div className="teacher-gap-column-header">
                    <Lightbulb size={15} />
                    <span>Bổ sung luyện tập</span>
                  </div>
                  {attentionTopics.length ? attentionTopics.map(renderTopicCard) : <p className="teacher-gap-placeholder">Hiện không có chủ đề cần theo dõi.</p>}
                </section>

                <section className="teacher-gap-column teacher-gap-column--strong">
                  <div className="teacher-gap-column-header">
                    <CheckCircle2 size={15} />
                    <span>Chủ đề ổn định</span>
                  </div>
                  {[...strongTopics, ...otherTopics].length
                    ? [...strongTopics, ...otherTopics].map(renderTopicCard)
                    : <p className="teacher-gap-placeholder">Chưa ghi nhận chủ đề ổn định.</p>}
                </section>
              </div>

              <div className="teacher-gap-next-step">
                <Target size={15} />
                <span>
                  Việc nên làm tiếp theo: bắt đầu với <strong>{highRiskTopics[0]?.label || attentionTopics[0]?.label || 'chủ đề yếu đầu tiên'}</strong>, sau đó giao một quiz ngắn hoặc bổ sung tài liệu cho lớp.
                </span>
              </div>
            </>
          )}
          <div className="heatmap-legend teacher-gap-legend">
            <span><span className="legend-box val-high"></span> Cần ưu tiên</span>
            <span><span className="legend-box val-med"></span> Cần theo dõi</span>
            <span><span className="legend-box val-none"></span> Ổn định</span>
          </div>
        </div>
      </div>

      <div className="glass-card span-2">
        <div className="card-header">
          <h3>Sinh viên trong lớp {classId}</h3>
        </div>
        {teacherStudents.length === 0 ? (
          <p className="no-data-text">Lớp chưa có sinh viên hoặc chưa tải được danh sách.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Sinh viên</th>
                <th>Email</th>
                <th>Trạng thái học</th>
                <th>Chủ đề còn yếu</th>
              </tr>
            </thead>
            <tbody>
              {teacherStudents.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="entity-name-cell">
                      <strong>{getPersonDisplayName(s, 'Sinh viên')}</strong>
                    </div>
                  </td>
                  <td>{s.email || s.studentEmail || '-'}</td>
                  <td><span className="badge active-badge">{s.status || 'Đang học'}</span></td>
                  <td>
                    {(s.weakTopics || []).map((wt, i) => (
                      <span key={`${wt}-${i}`} className={wt === 'None' ? 'tag-healthy' : 'tag-weak'}>{wt}</span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default TeacherClassesTab;
