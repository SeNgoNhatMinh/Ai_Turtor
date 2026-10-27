import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../app/queryKeys';
import { adminUsersApi } from '../../../services/adminUsersApi';
import { getUserFacingError } from '../../../services/apiClient';
import { ACCOUNT_ROLES } from '../../../constants/roles';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useRealtimeEvent, useRealtimeReconnect } from '../../realtime/realtimeContext';
import { REALTIME_EVENT_TYPES } from '../../realtime/realtimeEvents';

const EMPTY_LIST = [];

export function useAdminUsersController({ triggerToast, handleAdminImport }) {
  const queryClient = useQueryClient();
  const [userSearchQ, setUserSearchQ] = useState('');
  const [userFilterRole, setUserFilterRole] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const debouncedSearch = useDebouncedValue(userSearchQ, 300);
  const [editUser, setEditUser] = useState(null);
  const [updatingTeacherRoleId, setUpdatingTeacherRoleId] = useState('');
  const [adminImportLog, setAdminImportLog] = useState(null);

  const usersQuery = useQuery({
    queryKey: queryKeys.adminUsers({
      search: debouncedSearch.trim(),
      role: userFilterRole,
      page,
      size: pageSize,
    }),
    queryFn: ({ signal }) => adminUsersApi.getAdminUsers(
      debouncedSearch.trim(),
      userFilterRole,
      '',
      { signal, page, size: pageSize },
    ),
    staleTime: 30_000,
  });
  const mentorsQuery = useQuery({
    queryKey: queryKeys.adminMentors(),
    queryFn: ({ signal }) => adminUsersApi.getAdminMentors('', { signal }),
    staleTime: 60_000,
  });
  const escalationsQuery = useQuery({
    queryKey: queryKeys.adminEscalations(),
    queryFn: ({ signal }) => adminUsersApi.getAdminEscalations('', { signal }),
    staleTime: 15_000,
  });

  const usersPage = usersQuery.data || { users: EMPTY_LIST, totalElements: 0, page: 0, size: pageSize };
  const usersList = usersPage.users || EMPTY_LIST;
  const mentorsList = mentorsQuery.data || EMPTY_LIST;
  const escalationsList = escalationsQuery.data || EMPTY_LIST;

  useEffect(() => {
    const error = usersQuery.error || mentorsQuery.error || escalationsQuery.error;
    if (!error) return;
    triggerToast(getUserFacingError(error, 'Không thể tải đầy đủ dữ liệu quản trị tài khoản.'), 'error');
  }, [escalationsQuery.error, mentorsQuery.error, triggerToast, usersQuery.error]);

  const loadUsers = useCallback(async () => {
    await usersQuery.refetch();
  }, [usersQuery]);

  const loadMentors = useCallback(() => mentorsQuery.refetch(), [mentorsQuery]);
  const loadEscalations = useCallback(() => escalationsQuery.refetch(), [escalationsQuery]);

  const deleteUser = async (userId) => {
    try {
      await adminUsersApi.deleteAdminUser(userId);
      queryClient.setQueriesData({ queryKey: ['admin', 'users'] }, (current) => (
        current && Array.isArray(current.users)
          ? {
            ...current,
            users: current.users.filter((user) => user.id !== userId),
            totalElements: Math.max(0, Number(current.totalElements || 0) - 1),
          }
          : current
      ));
      triggerToast('Đã xóa tài khoản.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể xóa tài khoản.'), 'error');
    }
  };

  const updateUser = async (values) => {
    if (!editUser?.id) return false;
    try {
      await adminUsersApi.updateAdminUser(editUser.id, values);
      setEditUser(null);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      triggerToast('Đã cập nhật tài khoản.');
      return true;
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể cập nhật tài khoản.'), 'error');
      return false;
    }
  };

  const deleteMentor = async (mentorId) => {
    try {
      await adminUsersApi.deleteAdminMentor(mentorId);
      queryClient.setQueryData(queryKeys.adminMentors(), (current) => (
        Array.isArray(current) ? current.filter((mentor) => mentor.id !== mentorId) : current
      ));
      triggerToast('Đã xóa hồ sơ giảng viên.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể xóa hồ sơ giảng viên.'), 'error');
    }
  };

  const toggleMentor = async (mentorId, field, value) => {
    try {
      await adminUsersApi.updateAdminMentor(mentorId, { [field]: value });
      queryClient.setQueryData(queryKeys.adminMentors(), (current) => (
        Array.isArray(current)
          ? current.map((mentor) => (mentor.id === mentorId ? { ...mentor, [field]: value } : mentor))
          : current
      ));
      triggerToast('Đã cập nhật trạng thái giảng viên.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể cập nhật trạng thái giảng viên.'), 'error');
    }
  };

  const getMentorAccountRole = useCallback((mentor) => {
    const mentorEmail = String(mentor.email || '').trim().toLowerCase();
    const account = usersList.find((user) => (
      user.id === mentor.id
      || (mentorEmail && String(user.email || '').trim().toLowerCase() === mentorEmail)
    ));
    const role = mentor.role || account?.role;
    return role === ACCOUNT_ROLES.SENIOR_MENTOR
      ? ACCOUNT_ROLES.SENIOR_MENTOR
      : ACCOUNT_ROLES.TEACHER;
  }, [usersList]);

  const changeTeacherRole = async (mentor, nextRole) => {
    if (!mentor?.id || updatingTeacherRoleId) return;
    setUpdatingTeacherRoleId(mentor.id);
    try {
      const response = await adminUsersApi.updateTeacherRole(mentor.id, nextRole);
      const resolvedRole = response?.role || nextRole;
      queryClient.setQueryData(queryKeys.adminMentors(), (current) => (
        Array.isArray(current)
          ? current.map((item) => (item.id === mentor.id ? { ...item, role: resolvedRole } : item))
          : current
      ));
      queryClient.setQueriesData({ queryKey: ['admin', 'users'] }, (current) => (
        current && Array.isArray(current.users)
          ? {
            ...current,
            users: current.users.map((user) => (
              user.id === mentor.id
              || String(user.email || '').toLowerCase() === String(mentor.email || '').toLowerCase()
                ? { ...user, role: resolvedRole }
                : user
            )),
          }
          : current
      ));
      triggerToast(response?.message || 'Đã cập nhật vai trò. Giảng viên cần đăng nhập lại.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể cập nhật vai trò giảng viên.'), 'error');
    } finally {
      setUpdatingTeacherRoleId('');
    }
  };

  const deleteEscalation = async (escalationId) => {
    try {
      await adminUsersApi.deleteAdminEscalation(escalationId);
      queryClient.setQueryData(queryKeys.adminEscalations(), (current) => (
        Array.isArray(current) ? current.filter((item) => item.id !== escalationId) : current
      ));
      triggerToast('Đã xóa yêu cầu hỗ trợ.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể xóa yêu cầu hỗ trợ.'), 'error');
    }
  };

  const invalidateAllUsers = useCallback(() => {
    loadUsers();
    loadMentors();
    loadEscalations();
  }, [loadEscalations, loadMentors, loadUsers]);

  useRealtimeEvent(REALTIME_EVENT_TYPES.adminUser, invalidateAllUsers);
  useRealtimeEvent(REALTIME_EVENT_TYPES.supportEscalation, loadEscalations);
  useRealtimeReconnect(invalidateAllUsers);

  const importMentors = (file) => {
    Promise.resolve(handleAdminImport?.(file))
      .then(async (result) => {
        setAdminImportLog(result);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.adminMentors() }),
          queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
        ]);
      })
      .catch((error) => triggerToast(getUserFacingError(error, 'Không thể import giảng viên.'), 'error'));
    return false;
  };

  return {
    users: {
      list: usersList,
      loading: usersQuery.isPending || usersQuery.isFetching,
      error: usersQuery.error,
      search: userSearchQ,
      role: userFilterRole,
      page,
      pageSize,
      total: Number(usersPage.totalElements || 0),
      setPage: (nextPage, nextSize) => {
        setPage(nextSize === pageSize ? nextPage : 0);
        if (nextSize) setPageSize(nextSize);
      },
      editUser,
      setSearch: (value) => {
        setUserSearchQ(value);
        setPage(0);
      },
      setRole: (value) => {
        setUserFilterRole(value);
        setPage(0);
      },
      openEdit: setEditUser,
      closeEdit: () => setEditUser(null),
      reload: loadUsers,
      update: updateUser,
      remove: deleteUser,
    },
    mentors: {
      list: mentorsList,
      loading: mentorsQuery.isPending || mentorsQuery.isFetching,
      error: mentorsQuery.error,
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
      loading: escalationsQuery.isPending || escalationsQuery.isFetching,
      error: escalationsQuery.error,
      reload: loadEscalations,
      remove: deleteEscalation,
    },
  };
}
