import { createRoot } from 'react-dom/client';
import ConfirmCard from './ConfirmCard';

let activeConfirm = null;

const removeConfirmHosts = (exceptContainer = null) => {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('.app-confirm-host').forEach((container) => {
    if (container !== exceptContainer) container.remove();
  });
};

export const closeActiveConfirm = () => {
  const currentConfirm = activeConfirm;
  activeConfirm = null;

  if (currentConfirm) {
    const { root, container } = currentConfirm;
    root.unmount();
    container.remove();
  }

  // Vite HMR can recreate this module and reset activeConfirm while the old
  // portal is still mounted. Always remove those transparent full-screen hosts.
  removeConfirmHosts();
};

const openConfirm = ({
  title,
  content,
  okText,
  cancelText,
  onOk,
  danger = false,
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
      onClose={closeActiveConfirm}
    />,
  );
};

// Clean up a portal left behind by a previous hot-reloaded module.
removeConfirmHosts(activeConfirm?.container);

export const confirmDanger = ({
  title = 'Delete item?',
  content = 'This action cannot be undone.',
  okText = 'Delete',
  cancelText = 'Cancel',
  onOk,
}) => openConfirm({
  title,
  content,
  okText,
  cancelText,
  danger: true,
  onOk,
});

export const confirmAction = ({
  title = 'Confirm action?',
  content = 'Please confirm before continuing.',
  okText = 'Confirm',
  cancelText = 'Cancel',
  onOk,
}) => openConfirm({
  title,
  content,
  okText,
  cancelText,
  danger: false,
  onOk,
});
