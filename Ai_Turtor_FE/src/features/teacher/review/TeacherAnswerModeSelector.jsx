import { ACADEMIC_CANDIDATE_OPTIONS } from '../../../constants/knowledgeFlow';

function TeacherAnswerModeSelector({
  createKnowledgeCandidate,
  setCreateKnowledgeCandidate,
  setCandidateType,
  disabled = false,
}) {
  const chooseReplyOnly = () => {
    setCreateKnowledgeCandidate(false);
  };

  const chooseProposeKnowledge = () => {
    setCreateKnowledgeCandidate(true);
    setCandidateType('ACADEMIC_KNOWLEDGE');
  };

  return (
    <div
      style={{
        display: 'grid',
        gap: 10,
        marginTop: 12,
        marginBottom: 16,
        padding: '12px',
        background: 'rgba(17, 24, 39, 0.03)',
        border: '1px solid rgba(17, 24, 39, 0.1)',
        borderRadius: 10,
      }}
    >
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, margin: 0 }}>
        <input
          type="radio"
          name="teacher-answer-mode"
          checked={!createKnowledgeCandidate}
          onChange={chooseReplyOnly}
          disabled={disabled}
          style={{ cursor: 'pointer', width: 15, height: 15, marginTop: 2 }}
        />
        <span>
          Chỉ trả lời sinh viên
          <small style={{ display: 'block', color: '#6B7280', fontWeight: 400, marginTop: 2 }}>
            Quy định lớp, cách chấm, thời hạn và câu trả lời riêng cho bài tập không được thêm vào tri thức AI.
          </small>
        </span>
      </label>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, margin: 0 }}>
        <input
          type="radio"
          name="teacher-answer-mode"
          checked={createKnowledgeCandidate}
          onChange={chooseProposeKnowledge}
          disabled={disabled}
          style={{ cursor: 'pointer', width: 15, height: 15, marginTop: 2 }}
        />
        <span>
          Đề xuất tri thức AI có thể dùng lại
          <small style={{ display: 'block', color: '#6B7280', fontWeight: 400, marginTop: 2 }}>
            AI Tutor chỉ học nội dung này sau khi Senior Mentor hoặc Admin phê duyệt.
          </small>
        </span>
      </label>
      {createKnowledgeCandidate && (
        <p style={{ margin: '0 0 0 23px', fontSize: 12, color: '#6B7280' }}>
          Loại tri thức: {ACADEMIC_CANDIDATE_OPTIONS[0]?.label || 'Kiến thức học thuật'}
        </p>
      )}
    </div>
  );
}

export default TeacherAnswerModeSelector;
