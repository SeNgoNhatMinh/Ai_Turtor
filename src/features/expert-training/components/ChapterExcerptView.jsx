import { useMemo } from 'react';
import { Typography } from 'antd';
import { parseChapterExcerptBlocks } from '../chapterExcerptFormat';

const { Text } = Typography;

export default function ChapterExcerptView({
  excerpt,
  emptyMessage = 'Backend chưa trả về trích đoạn cho chương này.',
  truncated = false,
  totalChars = 0,
  fullSection = false,
  className = '',
}) {
  const blocks = useMemo(() => parseChapterExcerptBlocks(excerpt), [excerpt]);
  const hasContent = blocks.length > 0;

  return (
    <div className={`expert-training__excerpt-view ${className}`.trim()}>
      <div className="expert-training__excerpt-toolbar">
        <Text type="secondary" className="expert-training__excerpt-hint">
          Bôi đen để copy · Cuộn để đọc tiếp
        </Text>
      </div>
      <div
        className={`expert-training__excerpt-scroll ${fullSection ? 'expert-training__excerpt-scroll--full' : ''}`.trim()}
        tabIndex={0}
        role="region"
        aria-label="Nội dung tham khảo đã được định dạng"
      >
        {!hasContent ? (
          <p className="expert-training__excerpt-empty">{emptyMessage}</p>
        ) : (
          blocks.map((block, index) => {
            const key = `${block.type}-${index}-${String(block.text || '').slice(0, 24)}`;
            if (block.type === 'heading') {
              return (
                <h4 key={key} className="expert-training__excerpt-heading">
                  {block.text}
                </h4>
              );
            }
            if (block.type === 'list-item') {
              return (
                <p key={key} className="expert-training__excerpt-list-item">
                  {block.text}
                </p>
              );
            }
            if (block.type === 'code') {
              return (
                <pre key={key} className="expert-training__excerpt-sample-code">
                  <code>{block.text}</code>
                </pre>
              );
            }
            return (
              <p key={key} className="expert-training__excerpt-paragraph">
                {block.text}
              </p>
            );
          })
        )}
      </div>
      {truncated && (
        <Text type="secondary" className="expert-training__excerpt-truncated-note">
          Bản xem trước đã rút gọn
          {Number.isFinite(Number(totalChars)) && Number(totalChars) > 0
            ? ` từ ${Number(totalChars).toLocaleString('vi-VN')} ký tự`
            : ''}
          . Dùng <strong>Mở PDF tại mục chương</strong> để xem sơ đồ và trang đầy đủ.
        </Text>
      )}
      {!truncated && fullSection && (
        <Text type="secondary" className="expert-training__excerpt-truncated-note">
          Đã tải toàn bộ text section của chương. Hình minh họa vẫn cần mở PDF.
        </Text>
      )}
    </div>
  );
}
