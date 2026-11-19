import { Tag } from 'antd';

export default function ReviewSummaryTile({ tone = 'watch', tags = [], title, meta, onOpen }) {
  return (
    <button
      type="button"
      className={`answer-review-tile answer-review-tile--${tone}`}
      onClick={onOpen}
    >
      <div className="answer-review-tile__tags">
        {tags.map((tag) => (
          <Tag key={`${tag.color || 'default'}-${tag.label}`} color={tag.color}>{tag.label}</Tag>
        ))}
      </div>
      <h4>{title || 'Chưa có nội dung'}</h4>
      {meta ? <p>{meta}</p> : null}
      <small className="answer-review-tile__cta">Xem chi tiết</small>
    </button>
  );
}
