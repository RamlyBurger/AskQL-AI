"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { loginTesterUser } from "@/lib/api";

export default function TesterPage() {
  const router = useRouter();
  const { token, login } = useAuth();
  const [status, setStatus] = useState<'checking' | 'loading' | 'success' | 'error'>('checking');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleTesterLogin = async () => {
      // If already logged in, navigate back immediately
      if (token) {
        router.push('/');
        return;
      }

      // Otherwise, create/login tester user
      try {
        setStatus('loading');
        
        // Call backend tester endpoint
        const data = await loginTesterUser();
        
        // Login with the token
        login(data.access_token);
        
        // Redirect to main page immediately
        router.push('/');
        
      } catch (error) {
        console.error('Tester login failed:', error);
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred');
      }
    };

    handleTesterLogin();
  }, [token, login, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-950">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            AskQL
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            {status === 'checking' && 'Checking authentication...'}
            {status === 'loading' && 'Setting up tester account...'}
            {status === 'success' && 'Ready!'}
            {status === 'error' && 'Something went wrong'}
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-lg">
          {(status === 'checking' || status === 'loading') && (
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {status === 'checking' ? 'Checking login status...' : 'Creating tester account...'}
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                <svg
                  className="h-6 w-6 text-green-600 dark:text-green-400"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {token ? 'Already logged in!' : 'Tester account ready!'}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Redirecting to main page...
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                <svg
                  className="h-6 w-6 text-red-600 dark:text-red-400"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-sm font-medium text-red-600 dark:text-red-400">
                Failed to setup tester account
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {errorMessage}
              </p>
              <button
                onClick={() => router.push('/login')}
                className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Go to Login
              </button>
            </div>
          )}
        </div>

        <div className="text-center">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Tester credentials: tester@askql.com / tester123
          </p>
        </div>
      </div>
    </div>
  );
}
