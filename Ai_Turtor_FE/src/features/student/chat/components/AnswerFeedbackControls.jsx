import { Button, Dropdown, Input, Rate } from 'antd';
import {
  LikeOutlined,
  PushpinOutlined,
  StarOutlined,
  DownOutlined,
  WarningOutlined,
} from '@ant-design/icons';

const STAR_TOOLTIPS = ['Sai nghiêm trọng (1 sao)', 'Chưa chính xác', 'Chưa đủ tốt', 'Cần chi tiết hơn', 'Hữu ích'];

function AnswerFeedbackControls({
  index,
  message,
  isPinned,
  isPinning = false,
  isFeedbackSubmitting,
  feedbackOpenIndex,
  feedbackPanelMode,
  feedbackAction,
  feedbackText,
  setFeedbackText,
  onTogglePin,
  onHelpful,
  onToggleRatingPanel,
  onSelectStar,
  onOpenFeedback,
  onCloseFeedback,
  onSubmitFeedback,
}) {
  const panelOpen = feedbackOpenIndex === index;
  const starsOpen = panelOpen && feedbackPanelMode === 'stars';
  const formOpen = panelOpen && feedbackPanelMode === 'form';

  const reportMenu = {
    items: [
      {
        key: 'sourceConflict',
        label: 'Mâu thuẫn nguồn',
        onClick: () => onOpenFeedback(index, 'sourceConflict'),
      },
      {
        key: 'missingMaterial',
        label: 'Thiếu tài liệu',
        onClick: () => onOpenFeedback(index, 'missingMaterial'),
      },
    ],
  };

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
          className={starsOpen ? 'chat-feedback-toggle--active' : ''}
          icon={<StarOutlined />}
          disabled={isFeedbackSubmitting}
          onClick={() => onToggleRatingPanel(index)}
        >
          Đánh giá
        </Button>
        <Dropdown menu={reportMenu} trigger={['click']} disabled={isFeedbackSubmitting}>
          <Button type="text" size="small" icon={<WarningOutlined />} disabled={isFeedbackSubmitting}>
            Báo lỗi <DownOutlined style={{ fontSize: 10, marginInlineStart: 2 }} />
          </Button>
        </Dropdown>
      </div>

      {starsOpen && (
        <div className="chat-feedback-rating-panel">
          <span className="chat-feedback-rating-label">Chọn số sao (1–5)</span>
          <Rate
            disabled={isFeedbackSubmitting}
            tooltips={STAR_TOOLTIPS}
            onChange={(value) => onSelectStar(message, index, value)}
          />
        </div>
      )}

      {formOpen && (
        <div className="feedback-form-box chat-feedback-form-box">
          <div className="feedback-title chat-feedback-form-title">
            {feedbackAction?.prompt || 'Bạn muốn góp ý điều gì?'}
          </div>
          <Input.TextArea
            className="feedback-textarea"
            rows={2}
            placeholder={feedbackAction?.placeholder || 'Nhập nội dung góp ý...'}
            value={feedbackText}
            maxLength={2000}
            onChange={(e) => setFeedbackText(e.target.value)}
          />
          <div className="chat-feedback-form-actions">
            <Button size="small" type="text" className="chat-feedback-form-cancel" onClick={onCloseFeedback}>
              Hủy
            </Button>
            <Button
              className="btn-submit chat-feedback-form-submit"
              size="small"
              type="primary"
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
