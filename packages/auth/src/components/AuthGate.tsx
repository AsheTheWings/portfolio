'use client';

/**
 * AuthGate — inline sign-in / sign-up form.
 * Shown inside the agent playground when the user is not authenticated.
 */

import { useState } from 'react';
import { Button } from '@portfolio/ui/components/shadcn/button';
import { Input } from '@portfolio/ui/components/shadcn/input';
import { Label } from '@portfolio/ui/components/shadcn/label';
import { useAuthStore } from '../stores/authStore';
import type { UserPublic } from '../types';

type Mode = 'login' | 'signup';

export function AuthGate() {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setUser = useAuthStore((s) => s.setUser);

  const reqs = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'At least one uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'At least one lowercase letter', met: /[a-z]/.test(password) },
    { label: 'At least one number', met: /[0-9]/.test(password) },
    { label: 'At least one special character', met: /[^A-Za-z0-9]/.test(password) },
  ];
  const metCount = reqs.filter(r => r.met).length;
  const isPasswordValid = metCount === reqs.length;

  const getProgressColor = () => {
    switch (metCount) {
      case 0:
      case 1:
        return 'bg-destructive';
      case 2:
      case 3:
        return 'bg-amber-500';
      case 4:
        return 'bg-yellow-500';
      case 5:
        return 'bg-emerald-500';
      default:
        return 'bg-muted';
    }
  };

  const segments = Array.from({ length: 5 }, (_, i) => i < metCount);

  const isSubmitDisabled = loading || (mode === 'signup' && (!isPasswordValid || password !== confirmPassword));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'signup') {
      if (!isPasswordValid) {
        setError('Password does not meet all security requirements');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const body: Record<string, string> = { username, password };
      if (mode === 'signup') {
        if (email) body.email = email;
        if (fullName) body.fullName = fullName;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong');
        return;
      }

      setUser(data.user as UserPublic);

      if (typeof window !== 'undefined') {
        const searchParams = new URLSearchParams(window.location.search);
        const redirectUrl = searchParams.get('redirect');
        if (redirectUrl) {
          window.location.href = redirectUrl;
        }
      }
    } catch {
      setError('Network error — is the server running?');
    } finally {
      if (typeof window !== 'undefined') {
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.get('redirect')) {
          // If we are redirecting, keep loading state to prevent flash of playground
          return;
        }
      }
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Timeline</h1>
          <p className="text-sm text-muted-foreground">
            {mode === 'login' ? 'Sign in to continue' : 'Create an account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              disabled={loading}
            />
          </div>

          {mode === 'signup' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name (optional)</Label>
                <Input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                const val = e.target.value;
                const isValValid = val.length >= 8 &&
                  /[A-Z]/.test(val) &&
                  /[a-z]/.test(val) &&
                  /[0-9]/.test(val) &&
                  /[^A-Za-z0-9]/.test(val);
                if (!isValValid) {
                  setConfirmPassword('');
                }
              }}
              required
              minLength={mode === 'signup' ? 8 : 6}
              disabled={loading}
            />
            {mode === 'signup' && password.length > 0 && (
              <div className="pt-1">
                <div className="flex gap-1 mt-2">
                  {segments.map((filled, idx) => (
                    <div
                      key={idx}
                      className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                        filled ? getProgressColor() : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>
                {!isPasswordValid && (
                  <ul className="text-xs space-y-1.5 mt-3 text-muted-foreground transition-all duration-300">
                    {reqs.map((req, idx) => (
                      <li key={idx} className={`flex items-center gap-2 transition-colors duration-200 ${req.met ? 'text-emerald-500 font-medium' : ''}`}>
                        <span className={`flex items-center justify-center w-4 h-4 rounded-full border transition-colors duration-200 ${
                          req.met ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'border-muted-foreground/30 text-muted-foreground/30'
                        }`}>
                          {req.met ? (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <span className="w-1 h-1 rounded-full bg-current" />
                          )}
                        </span>
                        {req.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {mode === 'signup' && isPasswordValid && (
            <div className="space-y-2 transition-all duration-300">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitDisabled}>
            {loading
              ? 'Please wait…'
              : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {mode === 'login' ? (
            <>
              No account?{' '}
              <button
                type="button"
                className="underline underline-offset-4 hover:text-foreground transition-colors"
                onClick={() => { setMode('signup'); setError(null); setFullName(''); setConfirmPassword(''); }}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                className="underline underline-offset-4 hover:text-foreground transition-colors"
                onClick={() => { setMode('login'); setError(null); setFullName(''); setConfirmPassword(''); }}
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
