import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { queryKeys } from '../app/queryKeys';
import { getUserFacingError } from '../services/apiClient';
import { profileApi } from '../services/profileApi';

export function useProfile(userId) {
  const queryClient = useQueryClient();
  const resolvedUserId = String(userId || '').trim();
  const profileKey = queryKeys.profile(resolvedUserId);
  const profileQuery = useQuery({
    queryKey: profileKey,
    queryFn: () => profileApi.get(resolvedUserId),
    enabled: Boolean(resolvedUserId),
    staleTime: 60_000,
  });

  const updateProfile = useMutation({
    mutationFn: (payload) => profileApi.update(resolvedUserId, payload),
    onSuccess: (updated, payload) => {
      queryClient.setQueryData(profileKey, (current) => ({
        ...(current || {}),
        ...updated,
        ...payload,
      }));
      message.success('Đã cập nhật hồ sơ.');
    },
    onError: (error) => message.error(
      getUserFacingError(error, 'Không thể cập nhật hồ sơ.'),
    ),
  });

  const changePassword = useMutation({
    mutationFn: (payload) => profileApi.changePassword(resolvedUserId, payload),
    onSuccess: () => message.success('Đã đổi mật khẩu.'),
    onError: (error) => message.error(
      getUserFacingError(error, 'Không thể đổi mật khẩu.'),
    ),
  });

  return {
    profile: profileQuery.data || null,
    isLoading: profileQuery.isPending,
    isError: profileQuery.isError,
    error: profileQuery.error,
    updateProfile,
    changePassword,
  };
}
