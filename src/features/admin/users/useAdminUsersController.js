import { useCallback, useEffect, useState } from 'react';
import { adminUsersApi } from '../../../services/adminUsersApi';
import { getUserFacingError } from '../../../services/apiClient';
import { ACCOUNT_ROLES } from '../../../constants/roles';

export function useAdminUsersController({ triggerToast, handleAdminImport }) {
  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearchQ, setUserSearchQ] = useState('');
  const [userFilterRole, setUserFilterRole] = useState('');
  const [editUser, setEditUser] = useState(null);

  const [mentorsList, setMentorsList] = useState([]);
  const [mentorsLoading, setMentorsLoading] = useState(false);
  const [mentorRoleOverrides, setMentorRoleOverrides] = useState({});
  const [updatingTeacherRoleId, setUpdatingTeacherRoleId] = useState('');
  const [adminImportLog, setAdminImportLog] = useState(null);

  const [escalationsList, setEscalationsList] = useState([]);
  const [escalationsLoading, setEscalationsLoading] = useState(false);

  const loadUsersResource = useCallback(async (search = '', role = '') => {
    setUsersLoading(true);
    try {
      const data = await adminUsersApi.getAdminUsers(search, role);
      setUsersList(Array.isArray(data) ? data : []);
    } catch (error) {
      setUsersList([]);
      triggerToast(getUserFacingError(error, 'Không thể tải danh sách tài khoản.'));
    } finally {
      setUsersLoading(false);
    }
  }, [triggerToast]);

  const loadUsers = useCallback(
    () => loadUsersResource(userSearchQ, userFilterRole),
    [loadUsersResource, userFilterRole, userSearchQ],
  );

  const loadMentors = useCallback(async () => {
    setMentorsLoading(true);
    try {
      const data = await adminUsersApi.getAdminMentors();
      setMentorsList(Array.isArray(data) ? data : []);
    } catch (error) {
      setMentorsList([]);
      triggerToast(getUserFacingError(error, 'Không thể tải danh sách giảng viên.'));
    } finally {
      setMentorsLoading(false);
    }
  }, [triggerToast]);

  const loadEscalations = useCallback(async () => {
    setEscalationsLoading(true);
    try {
      const data = await adminUsersApi.getAdminEscalations();
      setEscalationsList(Array.isArray(data) ? data : []);
    } catch (error) {
      setEscalationsList([]);
      triggerToast(getUserFacingError(error, 'Không thể tải yêu cầu hỗ trợ.'));
    } finally {
      setEscalationsLoading(false);
    }
  }, [triggerToast]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      loadUsersResource('', '');
      loadMentors();
      loadEscalations();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [loadEscalations, loadMentors, loadUsersResource]);

  const deleteUser = async (userId) => {
    try {
      await adminUsersApi.deleteAdminUser(userId);
      setUsersList((current) => current.filter((user) => user.id !== userId));
      triggerToast('Đã xóa tài khoản.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể xóa tài khoản.'));
    }
  };

  const updateUser = async (values) => {
    if (!editUser?.id) return false;
    try {
      await adminUsersApi.updateAdminUser(editUser.id, values);
      setEditUser(null);
      await loadUsers();
      triggerToast('Đã cập nhật tài khoản.');
      return true;
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể cập nhật tài khoản.'));
      return false;
    }
  };

  const deleteMentor = async (mentorId) => {
    try {
      await adminUsersApi.deleteAdminMentor(mentorId);
      setMentorsList((current) => current.filter((mentor) => mentor.id !== mentorId));
      triggerToast('Đã xóa hồ sơ giảng viên.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể xóa hồ sơ giảng viên.'));
    }
  };

  const toggleMentor = async (mentorId, field, value) => {
    try {
      await adminUsersApi.updateAdminMentor(mentorId, { [field]: value });
      setMentorsList((current) => current.map((mentor) => (
        mentor.id === mentorId ? { ...mentor, [field]: value } : mentor
      )));
      triggerToast('Đã cập nhật trạng thái giảng viên.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể cập nhật trạng thái giảng viên.'));
    }
  };

  const getMentorAccountRole = useCallback((mentor) => {
    if (mentorRoleOverrides[mentor.id]) return mentorRoleOverrides[mentor.id];
    const mentorEmail = String(mentor.email || '').trim().toLowerCase();
    const account = usersList.find((user) => (
      user.id === mentor.id
      || (mentorEmail && String(user.email || '').trim().toLowerCase() === mentorEmail)
    ));
    return account?.role === ACCOUNT_ROLES.SENIOR_MENTOR
      ? ACCOUNT_ROLES.SENIOR_MENTOR
      : ACCOUNT_ROLES.TEACHER;
  }, [mentorRoleOverrides, usersList]);

  const changeTeacherRole = async (mentor, nextRole) => {
    if (!mentor?.id || updatingTeacherRoleId) return;
    setUpdatingTeacherRoleId(mentor.id);
    try {
      const response = await adminUsersApi.updateTeacherRole(mentor.id, nextRole);
      const resolvedRole = response?.role || nextRole;
      setMentorRoleOverrides((current) => ({ ...current, [mentor.id]: resolvedRole }));
      setUsersList((current) => current.map((user) => (
        user.id === mentor.id || String(user.email || '').toLowerCase() === String(mentor.email || '').toLowerCase()
          ? { ...user, role: resolvedRole }
          : user
      )));
      triggerToast(response?.message || 'Đã cập nhật vai trò. Giảng viên cần đăng nhập lại.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể cập nhật vai trò giảng viên.'));
    } finally {
      setUpdatingTeacherRoleId('');
    }
  };

  const deleteEscalation = async (escalationId) => {
    try {
      await adminUsersApi.deleteAdminEscalation(escalationId);
      setEscalationsList((current) => current.filter((item) => item.id !== escalationId));
      triggerToast('Đã xóa yêu cầu hỗ trợ.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể xóa yêu cầu hỗ trợ.'));
    }
  };

  const importMentors = (file) => {
    Promise.resolve(handleAdminImport?.(file))
      .then(setAdminImportLog)
      .catch((error) => triggerToast(getUserFacingError(error, 'Không thể import giảng viên.')));
    return false;
  };

  return {
    users: {
      list: usersList,
      loading: usersLoading,
      search: userSearchQ,
      role: userFilterRole,
      editUser,
      setSearch: setUserSearchQ,
      setRole: setUserFilterRole,
      openEdit: setEditUser,
      closeEdit: () => setEditUser(null),
      reload: loadUsers,
      update: updateUser,
      remove: deleteUser,
    },
    mentors: {
      list: mentorsList,
      loading: mentorsLoading,
      importLog: adminImportLog,
      updatingRoleId: updatingTeacherRoleId,
      reload: loadMentors,
      remove: deleteMentor,
      toggle: toggleMentor,
      getRole: getMentorAccountRole,
      changeRole: changeTeacherRole,
      importFile: importMentors,
    },
    escalations: {
      list: escalationsList,
      loading: escalationsLoading,
      reload: loadEscalations,
      remove: deleteEscalation,
    },
  };
}
