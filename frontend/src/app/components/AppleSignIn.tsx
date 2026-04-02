import React, { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../../stores/authStore';
import { Button } from './ui/button';
import { Card } from './ui/card';

/**
 * Apple Sign In Component
 * Integrates with native Apple Sign In flow
 */
export function AppleSignInComponent() {
  const navigate = useNavigate();
  const { signIn, isLoading, error, clearError } = useAuthStore();

  useEffect(() => {
    // Initialize AppleID.auth script for web
    // Reference: https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_js
    initializeAppleSignIn();
  }, []);

  const initializeAppleSignIn = () => {
    if (window.AppleID) {
      window.AppleID.auth.init({
        clientId: 'com.ichess.app',
        teamId: import.meta.env.VITE_APPLE_TEAM_ID || '',
        redirectURI: `${window.location.origin}/auth/callback`,
        scope: 'email name',
        usePopup: true,
      });
    }
  };

  const handleSignInClick = async () => {
    try {
      clearError();

      if (window.AppleID?.auth) {
        const data = await window.AppleID.auth.signIn();
        await signIn(data.authorization.id_token, {
          email: data.user?.email,
          name: data.user?.name,
        });
        navigate('/dashboard');
      } else {
        throw new Error('Apple Sign In not available');
      }
    } catch (err) {
      console.error('Sign in error:', err);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 to-slate-900">
      <Card className="w-full max-w-md p-8 bg-slate-800/50 border-slate-700">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-light tracking-tight text-white mb-2">iChess</h1>
          <p className="text-sm text-slate-400">Premium Chess Platform</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-900/20 border border-red-700/30 rounded-lg">
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        <Button
          onClick={handleSignInClick}
          disabled={isLoading}
          className="w-full h-12 bg-white text-black hover:bg-slate-100 font-medium"
        >
          {isLoading ? 'Signing in...' : 'Sign in with Apple ID'}
        </Button>

        <p className="mt-6 text-xs text-center text-slate-500">
          iChess is designed exclusively for Apple users. We never store your password and use
          Sign in with Apple for secure, private authentication.
        </p>
      </Card>
    </div>
  );
}

// TypeScript augmentation for Apple Sign In
declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (config: any) => void;
        signIn: () => Promise<any>;
      };
    };
  }
}

export default AppleSignInComponent;
