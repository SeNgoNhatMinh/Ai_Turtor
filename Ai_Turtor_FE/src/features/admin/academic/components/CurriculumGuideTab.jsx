import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Input, Modal, Row, Select, Space, Tag } from 'antd';
import { ArrowDownToLine, Check, Copy, Eye, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { adminAcademicApi } from '../../../../services/adminAcademicApi';
import { getCourseSelectOptions } from '../adminAcademicUtils';
import RichMarkdownEditor from './RichMarkdownEditor';
import { renderInlineMarkdown, renderMarkdownLines } from './inlineMarkdown';

const STATUS_META = {
  APPROVED: { color: 'green', label: 'Đã duyệt · đang hiển thị cho sinh viên' },
  PENDING_REVIEW: { color: 'orange', label: 'Chờ duyệt · sinh viên thấy bản parse từ syllabus' },
  REJECTED: { color: 'red', label: 'Đã từ chối' },
  FAILED: { color: 'red', label: 'Trích xuất lỗi' },
  NONE: { color: 'default', label: 'Chưa tạo · sinh viên thấy bản parse từ syllabus' },
  NO_SYLLABUS: { color: 'default', label: 'Môn chưa có syllabus' },
};

/**
 * Mẫu đầy đủ: admin dán toàn bộ curriculum vào một ô theo khung này, hệ
 * thống tự tách thành các phần của khung soạn bên dưới. Sao chép khung này,
 * điền nội dung đúng syllabus rồi dán trở lại.
 */
const FULL_TEMPLATE = `TÓM TẮT MÔN HỌC:
[Viết 1–2 câu tóm tắt môn học theo syllabus]

MỤC TIÊU KIẾN THỨC:
- [Mục tiêu kiến thức 1]
- [Mục tiêu kiến thức 2]

MỤC TIÊU KỸ NĂNG:
- [Mục tiêu kỹ năng 1]
- [Mục tiêu kỹ năng 2]

CHƯƠNG / CHỦ ĐỀ:
1. [Tên chương/chủ đề 1]: [Mô tả ngắn]
2. [Tên chương/chủ đề 2]: [Mô tả ngắn]`;

const SECTION_HEADERS = [
  { key: 'overview', pattern: /^(tóm tắt|tổng quan|giới thiệu|overview)/i },
  { key: 'knowledge', pattern: /^(mục tiêu kiến thức|kiến thức|knowledge)/i },
  { key: 'skills', pattern: /^(mục tiêu kỹ năng|kỹ năng|skills?)/i },
  { key: 'topics', pattern: /^(chương|chủ đề|nội dung|topics?|units?)/i },
];

function parseFullTemplate(text) {
  const result = { overview: [], knowledge: [], skills: [], topics: [] };
  let section = 'overview';
  let sectionsFound = 0;
  for (const rawLine of String(text || '').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const headerText = line.replace(/^#{1,6}\s+/, '').replace(/[:：]\s*$/, '');
    const matched = SECTION_HEADERS.find((header) => header.pattern.test(headerText));
    // Chỉ coi là tiêu đề mục khi dòng ngắn và (có dấu hai chấm ở cuối hoặc
    // trùng gần như trọn dòng), tránh nuốt nhầm dòng nội dung dài.
    if (matched && (line.endsWith(':') || line.endsWith('：') || headerText.length <= 30)) {
      section = matched.key;
      sectionsFound += 1;
      continue;
    }
    const clean = line.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '');
    if (section === 'topics') {
      const topicLine = clean.replace(/^(chương|chủ đề)\s*\d+\s*[:.]\s*/i, '');
      const separator = topicLine.match(/^(.+?)\s*:\s+(.+)$/) || topicLine.match(/^(.+?)\s+—\s+(.+)$/);
      const title = (separator ? separator[1] : topicLine).replace(/\*\*/g, '').trim();
      const detail = separator ? separator[2].trim() : '';
      if (title) result.topics.push({ title, detail });
    } else {
      result[section].push(clean);
    }
  }
  return { ...result, sectionsFound };
}

const linesToList = (text) => String(text || '')
  .split('\n')
  // The student view renders each item as a list row itself; a bullet/number
  // prefix typed via the toolbar would otherwise show up twice.
  .map((line) => line.trim().replace(/^[-*+]\s+/, '').replace(/^\d+[.)]\s+/, '').replace(/^>\s?/, ''))
  .filter(Boolean);

const listToLines = (items) => (Array.isArray(items) ? items : []).join('\n');

function CurriculumGuideTab({ courses, triggerToast }) {
  const courseOptions = useMemo(() => getCourseSelectOptions(courses), [courses]);
  const [courseId, setCourseId] = useState('');
  const [guide, setGuide] = useState(null);
  const [overview, setOverview] = useState('');
  const [knowledgeText, setKnowledgeText] = useState('');
  const [skillText, setSkillText] = useState('');
  const [topics, setTopics] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!courseId && courseOptions.length > 0) {
      setCourseId(courseOptions[0].value);
    }
  }, [courseId, courseOptions]);

  const load = useCallback(async (targetCourseId) => {
    if (!targetCourseId) return;
    try {
      setError('');
      const [adminGuide, studentGuide] = await Promise.all([
        adminAcademicApi.getLearningGuide(targetCourseId).catch(() => null),
        adminAcademicApi.getStudentLearningGuide(targetCourseId).catch(() => null),
      ]);
      setGuide(adminGuide);
      // Khung soạn luôn show đúng những gì sinh viên đang thấy để admin sửa
      // trên đó; mục nào phía sinh viên chưa có mới lấy từ guide đã lưu.
      const pickList = (studentList, adminList) => (
        Array.isArray(studentList) && studentList.length > 0 ? studentList : (adminList || [])
      );
      const shownTopics = pickList(studentGuide?.topics, adminGuide?.topics);
      setOverview(studentGuide?.overview || adminGuide?.overview || '');
      setKnowledgeText(listToLines(pickList(studentGuide?.knowledgeObjectives, adminGuide?.knowledgeObjectives)));
      setSkillText(listToLines(pickList(studentGuide?.skillObjectives, adminGuide?.skillObjectives)));
      setTopics(shownTopics.map((topic) => (
        typeof topic === 'string'
          ? { title: topic, detail: '' }
          : { title: topic.title || '', detail: topic.detail || '' }
      )));
    } catch (loadError) {
      setError(loadError?.message || 'Không tải được curriculum của môn.');
    }
  }, []);

  useEffect(() => {
    if (courseId) load(courseId);
  }, [courseId, load]);

  const run = async (action, successMessage) => {
    setBusy(true);
    try {
      setError('');
      const result = await action(courseId);
      if (result && result.status) setGuide(result);
      if (successMessage) triggerToast?.(successMessage, 'success');
      await load(courseId);
    } catch (actionError) {
      setError(actionError?.message || 'Thao tác thất bại.');
    } finally {
      setBusy(false);
    }
  };

  const handleSave = () => run(
    () => adminAcademicApi.updateLearningGuide(courseId, {
      overview: overview.trim(),
      knowledgeObjectives: linesToList(knowledgeText),
      skillObjectives: linesToList(skillText),
      topics: topics
        .map((topic) => ({ title: topic.title.trim(), detail: topic.detail.trim() }))
        .filter((topic) => topic.title),
    }),
    'Đã lưu curriculum. Nội dung mới đang hiển thị cho sinh viên.',
  );

  const [fullText, setFullText] = useState('');
  const [pasteMessage, setPasteMessage] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);

  const copyFullTemplate = async () => {
    try {
      await navigator.clipboard.writeText(FULL_TEMPLATE);
      triggerToast?.('Đã sao chép mẫu.', 'success');
    } catch {
      triggerToast?.('Không sao chép được. Bấm "Mẫu trống" để lấy mẫu.', 'error');
    }
  };

  const applyFullTemplate = () => {
    const parsed = parseFullTemplate(fullText);
    const hasContent = parsed.overview.length > 0 || parsed.knowledge.length > 0
      || parsed.skills.length > 0 || parsed.topics.length > 0;
    if (!hasContent) {
      setPasteMessage('Ô dán trống hoặc chưa đúng mẫu.');
      return;
    }
    if (parsed.overview.length > 0) setOverview(parsed.overview.join('\n'));
    if (parsed.knowledge.length > 0) setKnowledgeText(parsed.knowledge.join('\n'));
    if (parsed.skills.length > 0) setSkillText(parsed.skills.join('\n'));
    if (parsed.topics.length > 0) setTopics(parsed.topics);
    setPasteMessage('');
    setPasteOpen(false);
    triggerToast?.(
      `Đã nạp: ${parsed.knowledge.length} kiến thức · ${parsed.skills.length} kỹ năng · ${parsed.topics.length} chủ đề. Kiểm tra rồi bấm Lưu.`,
      'success',
    );
  };

  const updateTopic = (index, field, value) => {
    setTopics((current) => current.map((topic, topicIndex) => (
      topicIndex === index ? { ...topic, [field]: value } : topic
    )));
  };

  const status = guide?.status || 'NONE';
  const meta = STATUS_META[status] || STATUS_META.NONE;
  const warnings = guide?.validationWarnings || [];
  // Xem trước thời gian thực: panel "Sinh viên đang thấy" phản ánh ngay nội
  // dung đang sửa; keyword tự suy từ tiêu đề chủ đề giống phía server.
  const previewTopics = topics.filter((topic) => topic.title.trim());
  const previewKeywords = [...new Set(previewTopics.map((topic) => topic.title.trim()))];
  const previewKnowledge = linesToList(knowledgeText);
  const previewSkills = linesToList(skillText);
  const previewEmpty = !overview.trim()
    && previewKnowledge.length === 0
    && previewSkills.length === 0
    && previewTopics.length === 0;

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Card size="small" title="Chỉnh sửa Curriculum AI Tutor Guide">
        <Space wrap align="center">
          <Select
            aria-label="Chọn môn học"
            style={{ minWidth: 320 }}
            placeholder="Chọn môn học"
            options={courseOptions}
            value={courseId || undefined}
            onChange={setCourseId}
          />
          <Tag color={meta.color}>{meta.label}</Tag>
          {guide?.syllabusVersion && (
            <span>Phiên bản syllabus: <code>{guide.syllabusVersion}</code></span>
          )}
          <Button size="small" icon={<RefreshCw size={14} />} loading={busy} disabled={!courseId}
            onClick={() => load(courseId)}>
            Làm mới
          </Button>
          <Button size="small" loading={busy} disabled={!courseId}
            onClick={() => run(adminAcademicApi.regenerateLearningGuide, 'Đã trích xuất lại từ syllabus.')}>
            AI Hỗ Trợ Tạo
          </Button>
          <Button size="small" type="primary" ghost icon={<ArrowDownToLine size={14} />} disabled={!courseId}
            onClick={() => setPasteOpen(true)}>
            Nạp Curriculum Guide
          </Button>
          {status === 'PENDING_REVIEW' && (
            <>
              <Button size="small" type="primary" icon={<Check size={14} />} loading={busy}
                onClick={() => run(adminAcademicApi.approveLearningGuide, 'Đã duyệt curriculum.')}>
                Duyệt công khai
              </Button>
              <Button size="small" danger icon={<X size={14} />} loading={busy}
                onClick={() => run(adminAcademicApi.rejectLearningGuide, 'Đã từ chối bản trích xuất.')}>
                Từ chối
              </Button>
            </>
          )}
        </Space>
      </Card>

      {error && <Alert type="error" showIcon title={error} />}
      {warnings.length > 0 && (
        <Alert
          type="warning"
          showIcon
          title={`${warnings.length} cảnh báo kiểm chứng từ bản trích xuất`}
          description={warnings.join(' · ')}
        />
      )}

      <Modal
        title="Nạp Curriculum Guide"
        open={pasteOpen}
        width={760}
        onCancel={() => setPasteOpen(false)}
        footer={(
          <Space wrap>
            <Button icon={<Copy size={14} />} onClick={copyFullTemplate}>
              Sao chép mẫu
            </Button>
            <Button onClick={() => { setFullText(FULL_TEMPLATE); setPasteMessage(''); }}>
              Mẫu trống
            </Button>
            <Button danger type="text" icon={<Trash2 size={14} />} disabled={!fullText} onClick={() => { setFullText(''); setPasteMessage(''); }}>
              Xóa
            </Button>
            <Button onClick={() => setPasteOpen(false)}>
              Đóng
            </Button>
            <Button type="primary" icon={<ArrowDownToLine size={14} />} disabled={!fullText.trim()} onClick={applyFullTemplate}>
              Nạp
            </Button>
          </Space>
        )}
      >
        <p style={{ marginTop: 0 }}>
          Dán toàn bộ curriculum theo mẫu rồi bấm <strong>Nạp</strong> — hệ thống tự tách xuống các ô bên dưới.
        </p>
        <Input.TextArea
          aria-label="Nội dung Curriculum Guide"
          rows={13}
          value={fullText}
          onChange={(event) => { setFullText(event.target.value); setPasteMessage(''); }}
          placeholder={FULL_TEMPLATE}
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 }}
        />
        {pasteMessage && (
          <Alert type="warning" showIcon style={{ marginTop: 10 }} title={pasteMessage} />
        )}
      </Modal>

      <Row gutter={[16, 16]} align="top">
        <Col xs={24} lg={14}>
          <Card size="small" title="Nội dung chỉnh sửa">
            <Space orientation="vertical" size={14} style={{ width: '100%' }}>
              <label>
                <strong>Tóm tắt môn học (tối đa 1–2 dòng)</strong>
                <RichMarkdownEditor
                  ariaLabel="Tóm tắt môn học"
                  rows={2}
                  value={overview}
                  onChange={setOverview}
                  placeholder="Một hoặc hai câu tóm tắt lấy từ syllabus"
                />
              </label>
              <label>
                <strong>Mục tiêu kiến thức (mỗi dòng một mục)</strong>
                <RichMarkdownEditor
                  ariaLabel="Mục tiêu kiến thức"
                  rows={5}
                  value={knowledgeText}
                  onChange={setKnowledgeText}
                  placeholder={'Mỗi dòng một mục tiêu kiến thức. Bôi đen để in đậm/nghiêng, chèn link hoặc biểu tượng.'}
                />
              </label>
              <label>
                <strong>Mục tiêu kỹ năng (mỗi dòng một mục)</strong>
                <RichMarkdownEditor
                  ariaLabel="Mục tiêu kỹ năng"
                  rows={4}
                  value={skillText}
                  onChange={setSkillText}
                  placeholder={'Mỗi dòng một mục tiêu kỹ năng. Bôi đen để in đậm/nghiêng, chèn link hoặc biểu tượng.'}
                />
              </label>
              <div>
                <strong>Chương / chủ đề ({topics.length})</strong>
                <Space orientation="vertical" size={10} style={{ width: '100%', marginTop: 8 }}>
                  {topics.map((topic, index) => (
                    <div key={index} className="curriculum-topic-card">
                      <div className="curriculum-topic-card__header">
                        <span>Chủ đề {index + 1}</span>
                        <Button
                          danger
                          size="small"
                          type="text"
                          icon={<Trash2 size={14} />}
                          aria-label={`Xóa chủ đề ${index + 1}`}
                          onClick={() => setTopics((current) => current.filter((_, i) => i !== index))}
                        >
                          Xóa
                        </Button>
                      </div>
                      <label>
                        <span>Tiêu đề (cũng là keyword sinh viên thấy)</span>
                        <Input
                          aria-label={`Tiêu đề chủ đề ${index + 1}`}
                          style={{ width: '100%', marginTop: 4 }}
                          value={topic.title}
                          onChange={(event) => updateTopic(index, 'title', event.target.value)}
                          placeholder="Tiêu đề chương/chủ đề"
                        />
                      </label>
                      <label>
                        <span>Mô tả ngắn</span>
                        <RichMarkdownEditor
                          compact
                          ariaLabel={`Mô tả chủ đề ${index + 1}`}
                          rows={2}
                          value={topic.detail}
                          onChange={(value) => updateTopic(index, 'detail', value)}
                          placeholder="Mô tả ngắn (không bắt buộc). Bôi đen để in đậm/nghiêng hoặc chèn link."
                        />
                      </label>
                    </div>
                  ))}
                  <Button
                    size="small"
                    icon={<Plus size={14} />}
                    onClick={() => setTopics((current) => [...current, { title: '', detail: '' }])}
                  >
                    Thêm chủ đề
                  </Button>
                </Space>
              </div>
              <Space wrap>
                <Button type="primary" icon={<Save size={14} />} loading={busy} disabled={!courseId} onClick={handleSave}>
                  Lưu & công khai cho sinh viên
                </Button>
              </Space>
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card className="curriculum-preview-card" size="small" title={<span><Eye size={14} /> Sinh viên đang thấy </span>}>
            {previewEmpty ? (
              <span>Chưa có nội dung để hiển thị. Hãy nhập nội dung ở khung chỉnh sửa.</span>
            ) : (
              <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                {overview.trim() && <span>{renderMarkdownLines(overview.trim())}</span>}
                {previewKnowledge.length > 0 && (
                  <div>
                    <strong>Mục tiêu kiến thức</strong>
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                      {previewKnowledge.map((item) => <li key={item}>{renderInlineMarkdown(item.replace(/^[-*+]\s+/, ''))}</li>)}
                    </ul>
                  </div>
                )}
                {previewSkills.length > 0 && (
                  <div>
                    <strong>Mục tiêu kỹ năng</strong>
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                      {previewSkills.map((item) => <li key={item}>{renderInlineMarkdown(item.replace(/^[-*+]\s+/, ''))}</li>)}
                    </ul>
                  </div>
                )}
                {previewTopics.length > 0 && (
                  <div>
                    <strong>Chương / chủ đề</strong>
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                      {previewTopics.map((topic) => (
                        <li key={topic.title}>
                          <strong>{renderInlineMarkdown(topic.title)}</strong>
                          {topic.detail.trim() && <span>: {renderInlineMarkdown(topic.detail.trim())}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {previewKeywords.length > 0 && (
                  <div>
                    <strong>Keyword (tự động từ chủ đề)</strong>
                    <div style={{ marginTop: 6 }}>
                      <Space size={[6, 6]} wrap>
                        {previewKeywords.map((keyword) => <Tag key={keyword} color="blue">{keyword}</Tag>)}
                      </Space>
                    </div>
                  </div>
                )}
              </Space>
            )}
          </Card>
        </Col>
      </Row>
    </Space>
  );
}

export default CurriculumGuideTab;
