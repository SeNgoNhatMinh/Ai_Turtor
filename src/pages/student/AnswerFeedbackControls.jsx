import { Button, Input } from 'antd';
import { LikeOutlined, DislikeOutlined, CommentOutlined, PushpinOutlined } from '@ant-design/icons';

function AnswerFeedbackControls({
  index,
  isPinned,
  isPinning = false,
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
          loading={isPinning}
          disabled={isPinning}
          aria-label={isPinned ? 'Bỏ ghim tin nhắn' : 'Ghim tin nhắn'}
          title={isPinned ? 'Bỏ ghim tin nhắn' : 'Ghim tin nhắn'}
        />
        <Button
          type="text"
          size="small"
          icon={<LikeOutlined />}
          disabled={isFeedbackSubmitting}
          onClick={onHelpful}
        >
          Hữu ích
        </Button>
        <Button
          type="text"
          size="small"
          icon={<DislikeOutlined />}
          disabled={isFeedbackSubmitting}
          onClick={() => onOpenFeedback(index, 'notCorrect')}
        >
          Chưa chính xác
        </Button>
        <Button
          type="text"
          size="small"
          icon={<CommentOutlined />}
          disabled={isFeedbackSubmitting}
          onClick={() => onOpenFeedback(index, 'sourceConflict')}
        >
          Mâu thuẫn nguồn
        </Button>
        <Button
          type="text"
          size="small"
          icon={<CommentOutlined />}
          disabled={isFeedbackSubmitting}
          onClick={() => onOpenFeedback(index, 'missingMaterial')}
        >
          Thiếu tài liệu
        </Button>
        <Button
          type="text"
          size="small"
          icon={<CommentOutlined />}
          disabled={isFeedbackSubmitting}
          onClick={() => onOpenFeedback(index, 'needMoreDetail')}
        >
          Cần chi tiết hơn
        </Button>
        <Button
          type="text"
          size="small"
          danger
          icon={<DislikeOutlined />}
          disabled={isFeedbackSubmitting}
          onClick={() => onOpenFeedback(index, 'knowledgeError')}
        >
          Sai kiến thức nghiêm trọng
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
            {feedbackAction?.prompt || 'Bạn muốn góp ý điều gì?'}
          </div>
          <Input.TextArea
            className="feedback-textarea"
            rows={2}
            placeholder={feedbackAction?.placeholder || 'Nhập nội dung góp ý...'}
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
              Hủy
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
              Gửi góp ý
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

export default AnswerFeedbackControls;
