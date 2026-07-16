import { useRef } from 'react';
import { Button, Dropdown } from 'antd';
import { MoreHorizontal } from 'lucide-react';
import './EntityActionMenu.css';

function EntityActionMenu({
  items = [],
  onAction,
  ariaLabel = 'Row actions',
  disabled = false,
}) {
  const triggerRef = useRef(null);

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
            anchorRect:
              triggerRef.current?.getBoundingClientRect?.()
              || domEvent?.currentTarget?.getBoundingClientRect?.(),
          });
        },
      }}
    >
      <span
        ref={triggerRef}
        className="entity-action-trigger"
        onClick={(event) => event.stopPropagation()}
      >
        <Button
          type="text"
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
