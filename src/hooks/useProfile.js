import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/api';
import { message } from 'antd';

export function useProfile(userId) {
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => apiService.getUserProfile(userId),
    enabled: !!userId,
  });

  const updateProfile = useMutation({
    mutationFn: (payload) => apiService.updateUserProfile(userId, payload),
    onSuccess: () => {
      message.success('Profile updated successfully');
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
    onError: (error) => {
      message.error(error?.message || 'Failed to update profile');
    },
  });

  const changePassword = useMutation({
    mutationFn: (payload) => apiService.changePassword(userId, payload),
    onSuccess: () => {
      message.success('Password changed successfully');
    },
    onError: (error) => {
      message.error(error?.message || 'Failed to change password');
    },
  });

  return {
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    isError: profileQuery.isError,
    error: profileQuery.error,
    updateProfile,
    changePassword,
  };
}
