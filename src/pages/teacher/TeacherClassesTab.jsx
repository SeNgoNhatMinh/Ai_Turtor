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

const getTopicLabel = (node) => node?.label || node?.topic || node?.name || 'Untitled topic';

const getTopicDescription = (level) => {
  if (level === 'high') return 'Many students are struggling. Review this topic first.';
  if (level === 'medium') return 'Some signals need attention. Add practice or examples.';
  if (level === 'strong') return 'Students look stable here. Keep monitoring.';
  return 'Low signal. Check again after more student activity.';
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
          triggerToast?.(getUserFacingError(error, 'Unable to load course memory signals.'));
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
          <h3>Assigned Class Sections</h3>
          <button
            type="button"
            className="btn-small-chat"
            onClick={loadTeacherDashboard}
            disabled={teacherDashboardLoading || !loadTeacherDashboard}
            aria-label="Refresh assigned classes and learning signals"
          >
            <RefreshCw style={{ width: 12, height: 12 }} /> Refresh
          </button>
        </div>
        {teacherDashboardLoading ? (
          <p className="no-data-text">Loading dashboard...</p>
        ) : classesList.length === 0 ? (
          <p className="no-data-text">No class sections found.</p>
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
                  <span className="badge-semester">Term: {c.semester}</span>
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
            <h3>Knowledge Gap Overview</h3>
            <span className="card-subtitle">
              {currentClass?.name || `Class ${classId}`} · prioritized from learning memory, submissions, and quiz signals
            </span>
          </div>
        </div>

        <div className="teacher-gap-summary">
          <div className="teacher-gap-metric teacher-gap-metric--risk">
            <AlertTriangle size={16} />
            <div>
              <strong>{highRiskTopics.length}</strong>
              <span>High risk</span>
            </div>
          </div>
          <div className="teacher-gap-metric teacher-gap-metric--attention">
            <Lightbulb size={16} />
            <div>
              <strong>{attentionTopics.length}</strong>
              <span>Needs attention</span>
            </div>
          </div>
          <div className="teacher-gap-metric teacher-gap-metric--strong">
            <CheckCircle2 size={16} />
            <div>
              <strong>{strongTopics.length}</strong>
              <span>Strong</span>
            </div>
          </div>
        </div>

        <div className="teacher-course-memory-strip">
          <div>
            <strong>{courseMemoriesLoading ? '...' : memoryStats.memoryCount}</strong>
            <span>Memory records</span>
          </div>
          <div>
            <strong>{courseMemoriesLoading ? '...' : memoryStats.learnedCount}</strong>
            <span>Learned topics</span>
          </div>
          <div>
            <strong>{courseMemoriesLoading ? '...' : memoryStats.weakCount}</strong>
            <span>Weak topics</span>
          </div>
          <div>
            <strong>{memoryStats.latest ? new Date(memoryStats.latest).toLocaleDateString('en-US') : '—'}</strong>
            <span>Last memory update</span>
          </div>
        </div>

        <div className="heatmap-container heatmap-container--teacher">
          {!hasHeatmapData ? (
            <div className="teacher-gap-empty">
              <Target size={22} />
              <strong>No knowledge gap data yet</strong>
              <span>Ask students to use AI Tutor, submit work, or complete quizzes. The dashboard will summarize class weak topics here.</span>
            </div>
          ) : (
            <>
              <div className="teacher-gap-columns">
                <section className="teacher-gap-column teacher-gap-column--risk">
                  <div className="teacher-gap-column-header">
                    <AlertTriangle size={15} />
                    <span>Review first</span>
                  </div>
                  {highRiskTopics.length ? highRiskTopics.map(renderTopicCard) : <p className="teacher-gap-placeholder">No high-risk topic right now.</p>}
                </section>

                <section className="teacher-gap-column teacher-gap-column--attention">
                  <div className="teacher-gap-column-header">
                    <Lightbulb size={15} />
                    <span>Add practice</span>
                  </div>
                  {attentionTopics.length ? attentionTopics.map(renderTopicCard) : <p className="teacher-gap-placeholder">No medium-risk topic right now.</p>}
                </section>

                <section className="teacher-gap-column teacher-gap-column--strong">
                  <div className="teacher-gap-column-header">
                    <CheckCircle2 size={15} />
                    <span>Stable topics</span>
                  </div>
                  {[...strongTopics, ...otherTopics].length
                    ? [...strongTopics, ...otherTopics].map(renderTopicCard)
                    : <p className="teacher-gap-placeholder">No stable topic recorded yet.</p>}
                </section>
              </div>

              <div className="teacher-gap-next-step">
                <Target size={15} />
                <span>
                  Suggested next step: start with <strong>{highRiskTopics[0]?.label || attentionTopics[0]?.label || 'the first weak topic'}</strong>, then publish a short practice quiz or review material for this class.
                </span>
              </div>
            </>
          )}
          <div className="heatmap-legend teacher-gap-legend">
            <span><span className="legend-box val-high"></span> High risk</span>
            <span><span className="legend-box val-med"></span> Needs attention</span>
            <span><span className="legend-box val-none"></span> Strong</span>
          </div>
        </div>
      </div>

      <div className="glass-card span-2">
        <div className="card-header">
          <h3>Class Student List ({classId})</h3>
        </div>
        {teacherStudents.length === 0 ? (
          <p className="no-data-text">No students loaded from dashboard.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Email</th>
                <th>Learning Status</th>
                <th>Weak Topics</th>
              </tr>
            </thead>
            <tbody>
              {teacherStudents.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="entity-name-cell">
                      <strong>{getPersonDisplayName(s, 'Student')}</strong>
                    </div>
                  </td>
                  <td>{s.email || s.studentEmail || '-'}</td>
                  <td><span className="badge active-badge">{s.status || 'Enrolled'}</span></td>
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
