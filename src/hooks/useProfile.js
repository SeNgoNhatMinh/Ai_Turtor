import { useCallback, useEffect, useState } from 'react';
import { message } from 'antd';
import { getUserFacingError } from '../services/apiClient';
import { profileApi } from '../services/profileApi';

export function useProfile(userId) {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      setProfile(await profileApi.get(userId));
    } catch (nextError) {
      setError(nextError);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const loadTimer = window.setTimeout(loadProfile, 0);
    return () => window.clearTimeout(loadTimer);
  }, [loadProfile]);

  const updateProfile = {
    isPending: isUpdating,
    mutateAsync: async (payload) => {
      setIsUpdating(true);
      try {
        const updated = await profileApi.update(userId, payload);
        setProfile((current) => ({ ...current, ...updated, ...payload }));
        message.success('Profile updated successfully');
        return updated;
      } catch (nextError) {
        message.error(getUserFacingError(nextError, 'Failed to update profile'));
        throw nextError;
      } finally {
        setIsUpdating(false);
      }
    },
  };

  const changePassword = {
    isPending: isChangingPassword,
    mutateAsync: async (payload) => {
      setIsChangingPassword(true);
      try {
        const result = await profileApi.changePassword(userId, payload);
        message.success('Password changed successfully');
        return result;
      } catch (nextError) {
        message.error(getUserFacingError(nextError, 'Failed to change password'));
        throw nextError;
      } finally {
        setIsChangingPassword(false);
      }
    },
  };

  return {
    profile,
    isLoading,
    isError: Boolean(error),
    error,
    updateProfile,
    changePassword,
  };
}
