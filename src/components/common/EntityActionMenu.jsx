import { Button, Dropdown } from 'antd';
import { MoreHorizontal } from 'lucide-react';

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
          onAction?.(key, {
            domEvent,
            anchorRect: domEvent?.currentTarget?.getBoundingClientRect?.(),
          });
        },
      }}
    >
      <Button
        type="text"
        size="small"
        className="conversation-more-button entity-action-button"
        icon={<MoreHorizontal size={17} />}
        onClick={(event) => event.stopPropagation()}
        aria-label={ariaLabel}
        disabled={disabled}
      />
    </Dropdown>
  );
}

export default EntityActionMenu;
