import { useState, type FormEvent } from 'react';

import { LockIcon } from '../../shared/icons';
import { ApiError } from '../../shared/http';
import { useAuth } from './AuthContext';

type Mode = 'login' | 'register';

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,32}$/;
const MIN_PASSWORD_LENGTH = 8;

function validate(mode: Mode, username: string, password: string): string | null {
  if (!USERNAME_PATTERN.test(username.trim())) {
    return 'Username must be 3-32 characters: letters, digits or underscore.';
  }
  if (mode === 'register' && password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length === 0) return 'Enter your password.';
  return null;
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof DOMException) return 'Could not unlock your keys with this password.';
  return 'Could not reach the server. Try again.';
}

export function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = validate(mode, username, password);
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await (isRegister ? register : login)(username.trim(), password);
    } catch (caught) {
      setError(describeError(caught));
      setBusy(false);
    }
  }

  function switchMode() {
    setMode(isRegister ? 'login' : 'register');
    setError(null);
  }

  return (
    <main className="auth">
      <form className="auth__card" onSubmit={submit} noValidate>
        <div className="auth__badge">
          <LockIcon />
        </div>
        <h1 className="auth__title">{isRegister ? 'Create your account' : 'Welcome back'}</h1>
        <p className="auth__subtitle">
          Messages are encrypted on your device. Not even the server can read them.
        </p>

        <label className="field">
          <span className="field__label">Username</span>
          <input
            className="field__input"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
          />
        </label>

        <label className="field">
          <span className="field__label">Password</span>
          <input
            className="field__input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
          />
        </label>

        {isRegister && (
          <p className="auth__warning">
            Your password also protects your encryption keys. If you forget it, your message
            history cannot be recovered.
          </p>
        )}
        {error && (
          <p className="auth__error" role="alert">
            {error}
          </p>
        )}

        <button className="button button--primary" type="submit" disabled={busy}>
          {busy ? 'Securing your session…' : isRegister ? 'Create account' : 'Log in'}
        </button>

        <button className="button button--link" type="button" onClick={switchMode} disabled={busy}>
          {isRegister ? 'Already have an account? Log in' : 'New here? Create an account'}
        </button>
      </form>
    </main>
  );
}
