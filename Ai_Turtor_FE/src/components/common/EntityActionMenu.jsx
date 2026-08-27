import { Dropdown } from 'antd';
import { MoreHorizontal } from 'lucide-react';
import ActionButton from './ActionButton';
import './EntityActionMenu.css';

function EntityActionMenu({
  items = [],
  onAction,
  ariaLabel = 'Row actions',
  disabled = false,
}) {
  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      disabled={disabled}
      menu={{
        items,
        onClick: ({ key, domEvent }) => {
          domEvent.stopPropagation();
          onAction?.(key);
        },
      }}
    >
      <span
        className="entity-action-trigger"
        onClick={(event) => event.stopPropagation()}
      >
        <ActionButton
          intent="text"
          size="small"
          className="conversation-more-button entity-action-button"
          icon={<MoreHorizontal size={17} />}
          aria-label={ariaLabel}
          disabled={disabled}
        />
      </span>
    </Dropdown>
  );
}

export default EntityActionMenu;
