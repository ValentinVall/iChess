import { useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';

export function useAppleSignIn() {
  const { signIn, isLoading, error, clearError } = useAuthStore();

  const handleAppleSignIn = useCallback(
    async (response: any) => {
      try {
        clearError();

        // Extract identity token from Apple response
        const identityToken = response.authorization?.id_token;
        if (!identityToken) {
          throw new Error('No identity token from Apple');
        }

        const user = {
          name: response.user?.name,
          email: response.user?.email,
        };

        await signIn(identityToken, user);
        return true;
      } catch (err) {
        console.error('Apple Sign In failed:', err);
        return false;
      }
    },
    [signIn, clearError]
  );

  return {
    handleAppleSignIn,
    isLoading,
    error,
  };
}
