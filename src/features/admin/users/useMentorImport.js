import { adminUsersApi } from '../../../services/adminUsersApi';
import { getUserFacingError } from '../../../services/apiClient';
import { useMutationLock } from '../../../hooks/useMutationLock';

export function useMentorImport({ triggerToast }) {
  const { runLocked } = useMutationLock();

  const importMentors = (file) => runLocked('admin:mentor-import', async () => {
    if (!file) return null;
    triggerToast?.('Đang import giảng viên từ Excel...');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await adminUsersApi.importMentors(formData);
      triggerToast?.('Đã hoàn tất import giảng viên.');
      return response?.log || response?.message || null;
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không thể import giảng viên.'));
      return null;
    }
  });

  return { importMentors };
}
