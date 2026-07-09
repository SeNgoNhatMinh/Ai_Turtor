import React from 'react';
import { MessageSquare, RefreshCw } from 'lucide-react';
import { HEATMAP_CLASS } from './teacherPortalUtils';

function TeacherClassesTab({
  classId,
  setClassId,
  classesList = [],
  teacherStudents = [],
  teacherDashboardLoading,
  loadTeacherDashboard,
  heatmapNodes = [],
  triggerToast,
}) {
  return (
    <div className="grid-2x2 portal-view">
      <div className="glass-card">
        <div className="card-header">
          <h3>Assigned Class Sections</h3>
          <button type="button" className="btn-small-chat" onClick={() => loadTeacherDashboard?.()}>
            <RefreshCw style={{ width: 12, height: 12 }} /> Refresh
          </button>
        </div>
        {teacherDashboardLoading ? (
          <p className="no-data-text">Loading dashboard...</p>
        ) : classesList.length === 0 ? (
          <p className="no-data-text">No class sections found.</p>
        ) : (
          <div className="teacher-classes-list">
            {classesList.map((c, i) => (
              <div
                key={c.classCode || c.classId || c.id || i}
                className={`class-card-item ${classId === c.classCode ? 'active-class' : ''}`}
                onClick={() => setClassId(c.classCode)}
              >
                <span className="badge-semester">Term: {c.semester}</span>
                <h4>{c.name}</h4>
                <p>{c.details}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card">
        <div className="card-header">
          <h3>Class Knowledge Gap Heatmap (Class {classId})</h3>
          <span className="card-subtitle">From teacher dashboard API</span>
        </div>
        <div className="heatmap-container">
          <div className="heatmap-grid">
            {heatmapNodes.map((node, i) => (
              <div key={`${node.label}-${i}`} className={`heatmap-node ${HEATMAP_CLASS[node.level] || 'val-none'}`}>
                {node.label}
              </div>
            ))}
          </div>
          <div className="heatmap-legend">
            <span className="legend-box val-high"></span> High risk (Red)
            <span className="legend-box val-med"></span> Needs attention (Yellow)
            <span className="legend-box val-none"></span> Strong (Green)
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
                <th>Student ID</th>
                <th>Full Name</th>
                <th>Email</th>
                <th>Learning Status</th>
                <th>Weak Topics</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {teacherStudents.map((s) => (
                <tr key={s.id}>
                  <td><code>{s.id || s.studentId}</code></td>
                  <td>{s.name || s.studentName || s.fullName}</td>
                  <td>{s.email || s.studentEmail || '-'}</td>
                  <td><span className="badge active-badge">{s.status || 'Enrolled'}</span></td>
                  <td>
                    {(s.weakTopics || []).map((wt, i) => (
                      <span key={`${wt}-${i}`} className={wt === 'None' ? 'tag-healthy' : 'tag-weak'}>{wt}</span>
                    ))}
                  </td>
                  <td>
                    <button type="button" className="btn-small-chat" onClick={() => triggerToast?.(`Opening support chat with ${s.name}...`)}>
                      <MessageSquare style={{ width: 12, height: 12 }} /> Support
                    </button>
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
