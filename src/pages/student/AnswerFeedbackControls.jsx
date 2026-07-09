import { Button, Input } from 'antd';
import { LikeOutlined, DislikeOutlined, CommentOutlined, PushpinOutlined } from '@ant-design/icons';

function AnswerFeedbackControls({
  index,
  isPinned,
  isFeedbackSubmitting,
  feedbackOpenIndex,
  feedbackAction,
  feedbackText,
  setFeedbackText,
  onTogglePin,
  onHelpful,
  onOpenFeedback,
  onCloseFeedback,
  onSubmitFeedback,
}) {
  return (
    <>
      <div className="chat-gpt-feedback-row">
        <Button
          type="text"
          size="small"
          className={`chat-pin-action ${isPinned ? 'chat-pin-action--active' : ''}`}
          icon={<PushpinOutlined />}
          onClick={onTogglePin}
          aria-label={isPinned ? 'Unpin message' : 'Pin message'}
          title={isPinned ? 'Unpin message' : 'Pin message'}
        />
        <Button
          type="text"
          size="small"
          icon={<LikeOutlined />}
          disabled={isFeedbackSubmitting}
          onClick={onHelpful}
        >
          Helpful
        </Button>
        <Button
          type="text"
          size="small"
          icon={<DislikeOutlined />}
          disabled={isFeedbackSubmitting}
          onClick={() => onOpenFeedback(index, 'notCorrect')}
        >
          Not correct
        </Button>
        <Button
          type="text"
          size="small"
          icon={<CommentOutlined />}
          disabled={isFeedbackSubmitting}
          onClick={() => onOpenFeedback(index, 'sourceConflict')}
        >
          Source conflict
        </Button>
        <Button
          type="text"
          size="small"
          icon={<CommentOutlined />}
          disabled={isFeedbackSubmitting}
          onClick={() => onOpenFeedback(index, 'missingMaterial')}
        >
          Missing material
        </Button>
        <Button
          type="text"
          size="small"
          icon={<CommentOutlined />}
          disabled={isFeedbackSubmitting}
          onClick={() => onOpenFeedback(index, 'needMoreDetail')}
        >
          Need more detail
        </Button>
      </div>

      {feedbackOpenIndex === index && (
        <div
          className="feedback-form-box"
          style={{
            marginTop: 12,
            background: '#f9f9f9',
            border: '1px solid #ececec',
            padding: 12,
            borderRadius: 12,
          }}
        >
          <div className="feedback-title" style={{ marginBottom: 8, fontSize: 12, color: '#0d0d0d' }}>
            {feedbackAction?.prompt || 'What feedback should we record?'}
          </div>
          <Input.TextArea
            className="feedback-textarea"
            rows={2}
            placeholder={feedbackAction?.placeholder || 'Add feedback...'}
            value={feedbackText}
            maxLength={2000}
            onChange={(e) => setFeedbackText(e.target.value)}
            style={{
              background: '#fff',
              border: '1px solid #ececec',
              color: '#0d0d0d',
              borderRadius: 8,
              marginBottom: 8,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button size="small" type="text" style={{ color: '#888' }} onClick={onCloseFeedback}>
              Cancel
            </Button>
            <Button
              className="btn-submit"
              size="small"
              type="primary"
              style={{ background: '#0d0d0d', color: '#ffffff', border: 'none' }}
              onClick={onSubmitFeedback}
              loading={isFeedbackSubmitting}
              disabled={!feedbackText.trim() || isFeedbackSubmitting}
            >
              Submit
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

export default AnswerFeedbackControls;
