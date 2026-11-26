import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Checkbox, Input, Radio } from 'antd';
import { CheckCircle2, Send } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import AsyncState from '../../components/common/AsyncState';
import { feedbackApi } from '../../services/feedbackApi';
import { getUserFacingError } from '../../services/apiClient';
import { DEVICE_OPTIONS, FEATURE_OPTIONS, RATING_QUESTIONS } from './feedbackOptions';
import './Feedback.css';

const EMPTY = {
  overall: null,
  aiQuality: null,
  speed: null,
  easeOfUse: null,
  recommend: null,
  device: null,
  featuresUsed: [],
  hadIssues: null,
  issueDetail: '',
  liked: '',
  improve: '',
};
const FEEDBACK_KEY = ['feedback', 'me'];

function Scale({ id, value, min, max, onChange, lowLabel, highLabel }) {
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div className="feedback-scale">
      <div className="feedback-scale__buttons" role="radiogroup" aria-labelledby={id}>
        {values.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            className={`feedback-scale__button${value === n ? ' is-selected' : ''}`}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="feedback-scale__ends" aria-hidden="true">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

export default function StudentFeedbackPage({ courseId, classId, triggerToast }) {
  const mineQuery = useQuery({
    queryKey: FEEDBACK_KEY,
    queryFn: ({ signal }) => feedbackApi.getMine({ signal }),
    staleTime: 60_000,
  });

  if (mineQuery.isPending) {
    return <AsyncState loading loadingLabel="Đang tải khảo sát..." loadingRows={5} />;
  }
  const saved = mineQuery.data?.updatedAt ? mineQuery.data : null;
  // Keyed on the saved answer so the form starts from it once loaded and after each save.
  return (
    <FeedbackForm
      key={saved?.updatedAt || 'new'}
      saved={saved}
      loadError={mineQuery.error}
      courseId={courseId}
      classId={classId}
      triggerToast={triggerToast}
    />
  );
}

function FeedbackForm({ saved, loadError, courseId, classId, triggerToast }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => (saved ? { ...EMPTY, ...saved, featuresUsed: saved.featuresUsed || [] } : EMPTY));
  const [missing, setMissing] = useState([]);
  const submitted = Boolean(saved);

  const mutation = useMutation({
    mutationFn: (payload) => feedbackApi.submit(payload),
    onSuccess: (saved) => {
      queryClient.setQueryData(FEEDBACK_KEY, saved);
      triggerToast?.('Đã gửi góp ý. Cảm ơn bạn!', 'success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  });

  const set = (key) => (value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setMissing((current) => current.filter((item) => item !== key));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const required = [...RATING_QUESTIONS.map((q) => q.key), 'recommend'];
    const absent = required.filter((key) => form[key] == null);
    setMissing(absent);
    if (absent.length) return;
    mutation.mutate({ ...form, courseId, classId });
  };

  return (
    <div className="feedback-page">
      <PageHeader
        eyebrow="Góp ý trải nghiệm"
        title="Bạn thấy AI Tutor thế nào?"
        description="Khoảng 2 phút. Góp ý của bạn giúp nhóm sửa lỗi và cải thiện câu trả lời của AI. Bạn có thể gửi lại để cập nhật bất cứ lúc nào."
      />

      {submitted && !mutation.isPending && (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircle2 size={18} />}
          message="Bạn đã gửi góp ý"
          description="Các câu trả lời trước đó đang hiện bên dưới. Sửa và bấm Cập nhật nếu muốn thay đổi."
        />
      )}
      {loadError && (
        <Alert type="warning" showIcon message={getUserFacingError(loadError, 'Không tải được góp ý trước đó. Bạn vẫn có thể gửi mới.')} />
      )}

      <form className="feedback-form" onSubmit={handleSubmit} noValidate>
        {RATING_QUESTIONS.map((q, index) => (
          <fieldset key={q.key} className={`feedback-question${missing.includes(q.key) ? ' is-missing' : ''}`}>
            <legend id={`fb-${q.key}`}>{index + 1}. {q.label}</legend>
            <Scale id={`fb-${q.key}`} value={form[q.key]} min={1} max={5} onChange={set(q.key)} lowLabel={q.low} highLabel={q.high} />
          </fieldset>
        ))}

        <fieldset className={`feedback-question${missing.includes('recommend') ? ' is-missing' : ''}`}>
          <legend id="fb-recommend">5. Bạn có giới thiệu AI Tutor cho bạn bè cùng học không?</legend>
          <Scale id="fb-recommend" value={form.recommend} min={0} max={10} onChange={set('recommend')} lowLabel="Chắc chắn không" highLabel="Chắc chắn có" />
        </fieldset>

        <fieldset className="feedback-question">
          <legend>6. Bạn dùng AI Tutor chủ yếu trên thiết bị nào?</legend>
          <Radio.Group
            id="fb-device"
            className="feedback-choices"
            value={form.device}
            onChange={(event) => set('device')(event.target.value)}
            options={DEVICE_OPTIONS}
          />
        </fieldset>

        <fieldset className="feedback-question">
          <legend>7. Bạn đã dùng những tính năng nào? (chọn nhiều)</legend>
          <Checkbox.Group
            id="fb-features"
            className="feedback-choices feedback-choices--stack"
            value={form.featuresUsed}
            onChange={set('featuresUsed')}
            options={FEATURE_OPTIONS}
          />
        </fieldset>

        <fieldset className="feedback-question">
          <legend>8. Bạn có gặp lỗi hoặc chỗ khó dùng không?</legend>
          <Radio.Group
            id="fb-issues"
            className="feedback-choices"
            value={form.hadIssues}
            onChange={(event) => set('hadIssues')(event.target.value)}
            options={[{ value: false, label: 'Không' }, { value: true, label: 'Có' }]}
          />
          {form.hadIssues === true && (
            <Input.TextArea
              id="fb-issue-detail"
              aria-label="Mô tả lỗi gặp phải"
              value={form.issueDetail || ''}
              onChange={(event) => set('issueDetail')(event.target.value)}
              placeholder="Lỗi xảy ra ở trang nào, khi bạn làm gì? Ví dụ: bấm Học ngay trên điện thoại thì không thấy trả lời."
              autoSize={{ minRows: 3, maxRows: 8 }}
              maxLength={2000}
              showCount
            />
          )}
        </fieldset>

        <fieldset className="feedback-question">
          <legend id="fb-liked-legend">9. Điều bạn thích nhất</legend>
          <Input.TextArea
            id="fb-liked"
            aria-labelledby="fb-liked-legend"
            value={form.liked || ''}
            onChange={(event) => set('liked')(event.target.value)}
            placeholder="Không bắt buộc"
            autoSize={{ minRows: 2, maxRows: 6 }}
            maxLength={2000}
          />
        </fieldset>

        <fieldset className="feedback-question">
          <legend id="fb-improve-legend">10. Điều cần cải thiện</legend>
          <Input.TextArea
            id="fb-improve"
            aria-labelledby="fb-improve-legend"
            value={form.improve || ''}
            onChange={(event) => set('improve')(event.target.value)}
            placeholder="Không bắt buộc"
            autoSize={{ minRows: 2, maxRows: 6 }}
            maxLength={2000}
          />
        </fieldset>

        {missing.length > 0 && (
          <Alert type="error" showIcon message="Vui lòng chọn điểm cho các câu được đánh dấu đỏ (câu 1–5)." />
        )}
        {mutation.error && (
          <Alert type="error" showIcon message={getUserFacingError(mutation.error, 'Chưa gửi được góp ý. Vui lòng thử lại.')} />
        )}

        <div className="feedback-actions">
          <Button type="primary" htmlType="submit" size="large" loading={mutation.isPending} icon={<Send size={16} />}>
            {submitted ? 'Cập nhật góp ý' : 'Gửi góp ý'}
          </Button>
        </div>
      </form>
    </div>
  );
}
