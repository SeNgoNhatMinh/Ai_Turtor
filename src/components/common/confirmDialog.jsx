import { createRoot } from 'react-dom/client';
import ConfirmCard from './ConfirmCard';

let activeConfirm = null;

export const closeActiveConfirm = () => {
  if (!activeConfirm) return;
  const { root, container } = activeConfirm;
  root.unmount();
  container.remove();
  activeConfirm = null;
};

const openConfirm = ({
  title,
  content,
  okText,
  cancelText,
  onOk,
  danger = false,
  anchorRect,
}) => {
  closeActiveConfirm();
  const container = document.createElement('div');
  container.className = 'app-confirm-host';
  document.body.appendChild(container);
  const root = createRoot(container);
  activeConfirm = { root, container };
  root.render(
    <ConfirmCard
      title={title}
      content={content}
      okText={okText}
      cancelText={cancelText}
      danger={danger}
      onOk={onOk}
      anchorRect={anchorRect}
      onClose={closeActiveConfirm}
    />,
  );
};

export const confirmDanger = ({
  title = 'Delete item?',
  content = 'This action cannot be undone.',
  okText = 'Delete',
  cancelText = 'Cancel',
  onOk,
  anchorRect,
}) => openConfirm({
  title,
  content,
  okText,
  cancelText,
  danger: true,
  onOk,
  anchorRect,
});

export const confirmAction = ({
  title = 'Confirm action?',
  content = 'Please confirm before continuing.',
  okText = 'Confirm',
  cancelText = 'Cancel',
  onOk,
  anchorRect,
}) => openConfirm({
  title,
  content,
  okText,
  cancelText,
  danger: false,
  onOk,
  anchorRect,
});
