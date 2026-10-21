'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { User } from '../lib/types';
import { AuthArt } from './auth-art';
import { useAuth } from './Providers';
import { Button, cx, Eyebrow, Field, Input } from './ui';

type Mode = 'login' | 'register';
type Values = Record<string, string>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const copy = {
  login: { eyebrow: 'Welcome back', title: 'Sign in', sub: 'Pick up where you left off. Your watchlist and live bids are waiting.', submit: 'Sign in', busy: 'Signing in…', switchText: 'New to BidNest?', switchLink: '/register', switchLabel: 'Create account' },
  register: { eyebrow: 'Create your paddle', title: 'Join the room', sub: 'Bid on lots, follow prices live and get an alert the moment you are outbid.', submit: 'Create account', busy: 'Creating account…', switchText: 'Already a member?', switchLink: '/login', switchLabel: 'Sign in' },
} as const;

interface FieldConfig {
  name: string;
  label: string;
  type: string;
  autoComplete: string;
  placeholder: string;
  validate: (value: string, mode: Mode) => string | null;
}

const fieldConfigs: Record<string, FieldConfig> = {
  fullName: { name: 'fullName', label: 'Full name', type: 'text', autoComplete: 'name', placeholder: 'Elena Marsh', validate: value => (value.trim() ? null : 'Tell us your name') },
  username: { name: 'username', label: 'Username', type: 'text', autoComplete: 'username', placeholder: 'elena_m', validate: value => (value.trim().length >= 3 ? null : 'Use at least 3 characters') },
  email: { name: 'email', label: 'Email', type: 'email', autoComplete: 'email', placeholder: 'you@example.com', validate: value => (EMAIL.test(value) ? null : value ? 'Enter a full email address, like name@domain.com' : 'Enter your email') },
  password: {
    name: 'password',
    label: 'Password',
    type: 'password',
    autoComplete: 'current-password',
    placeholder: '••••••••',
    validate: (value, mode) => (!value ? 'Enter your password' : mode === 'register' && value.length < 8 ? 'Use at least 8 characters' : null),
  },
};

const fieldsByMode: Record<Mode, string[]> = {
  login: ['email', 'password'],
  register: ['fullName', 'username', 'email', 'password'],
};

const strengthLevels = [
  { label: '', bar: 'bg-surface-3', text: 'text-muted' },
  { label: 'Too short', bar: 'bg-danger', text: 'text-danger' },
  { label: 'Weak', bar: 'bg-outbid', text: 'text-outbid' },
  { label: 'Good', bar: 'bg-gold-400', text: 'text-gold-400' },
  { label: 'Strong', bar: 'bg-live', text: 'text-live' },
];

const strengthOf = (password: string) => (!password ? 0 : password.length < 8 ? 1 : 1 + [/[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(pattern => pattern.test(password)).length);

const StrengthMeter = ({ password }: { password: string }) => {
  const score = strengthOf(password);
  const level = strengthLevels[score]!;
  return (
    <div className="mt-2.5 flex items-center gap-3">
      <div className="grid flex-1 grid-cols-4 gap-1">
        {[1, 2, 3, 4].map(segment => (
          <span key={segment} className={cx('h-0.5 transition-colors duration-200', segment <= score ? level.bar : 'bg-white/10')} />
        ))}
      </div>
      <span className={cx('min-w-[72px] text-right text-xs', level.text)}>{level.label}</span>
    </div>
  );
};

const devAccounts = [
  { label: 'Admin', email: 'admin@bidnest.test' },
  { label: 'Maya', email: 'maya@bidnest.test' },
  { label: 'Omar', email: 'omar@bidnest.test' },
];

export const AuthForm = ({ mode }: { mode: Mode }) => {
  const { login, register } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const next = useSearchParams().get('next');
  const [values, setValues] = useState<Values>({});
  const [touched, setTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const text = copy[mode];
  const fields = fieldsByMode[mode].map(key => fieldConfigs[key]!);
  const errors = Object.fromEntries(fields.map(field => [field.name, touched ? field.validate(values[field.name] ?? '', mode) : null]));
  const hasErrors = fields.some(field => field.validate(values[field.name] ?? '', mode));

  const devLogin = async (email: string) => {
    const user = await api.post<User>('/auth/dev-login', { email });
    queryClient.clear();
    queryClient.setQueryData(['me'], user);
    router.replace(user.role === 'ADMIN' ? '/admin' : '/dashboard');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    setError(null);
    if (hasErrors) return;
    setSubmitting(true);
    try {
      const user = mode === 'login' ? await login({ email: values.email!, password: values.password! }) : await register({ email: values.email!, password: values.password!, username: values.username!, fullName: values.fullName! });
      router.replace(next?.startsWith('/') ? next : user.role === 'ADMIN' ? '/admin' : '/dashboard');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Something went wrong.');
      setSubmitting(false);
    }
  };

  return (
    <div className="rise grid min-h-[680px] overflow-hidden border border-line lg:grid-cols-[1.05fr_1fr]">
      <style>{'@keyframes shake{0%,100%{transform:none}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}'}</style>
      <AuthArt mode={mode} />
      <div className="flex flex-col px-6 py-10 sm:px-12 lg:px-16 xl:px-28">
        <div className="flex h-9 items-center justify-end gap-2.5 text-sm text-muted">
          {text.switchText}
          <Link href={text.switchLink} className="inline-flex h-9 items-center rounded-full border border-line-strong px-4 text-[13px] font-medium text-text transition hover:border-gold-300 hover:bg-gold-300/5">
            {text.switchLabel}
          </Link>
        </div>

        <div className="flex w-full max-w-[460px] flex-1 flex-col justify-center py-10">
          <form onSubmit={submit} noValidate className="flex flex-col gap-8">
            <div className="flex flex-col gap-3.5">
              <Eyebrow>{text.eyebrow}</Eyebrow>
              <h1 className="display text-5xl sm:text-[64px] sm:leading-none">{text.title}</h1>
              <p className="text-[15px] leading-relaxed text-text-2">{text.sub}</p>
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-3 rounded-xs border border-danger/35 bg-danger/6 px-4 py-3.5 [animation:shake_.4s_ease-out]">
                <span className="mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border border-danger text-[11px] font-bold text-danger">!</span>
                <p className="text-sm font-semibold text-danger">{error}</p>
              </div>
            )}

            <div className="flex flex-col gap-7">
              {fields.map(field => {
                const isPassword = field.name === 'password';
                const fieldError = errors[field.name];
                return (
                  <Field key={field.name} label={field.label} error={fieldError ?? undefined}>
                    <span className="relative block">
                      <Input
                        name={field.name}
                        type={isPassword && showPassword ? 'text' : field.type}
                        autoComplete={isPassword && mode === 'register' ? 'new-password' : field.autoComplete}
                        placeholder={isPassword && mode === 'register' ? 'At least 8 characters' : field.placeholder}
                        value={values[field.name] ?? ''}
                        onChange={event => {
                          setValues({ ...values, [field.name]: event.target.value });
                          setError(null);
                        }}
                        aria-invalid={Boolean(fieldError)}
                        className={cx('h-[52px] text-lg', isPassword ? 'pr-16' : 'pr-8')}
                      />
                      {isPassword && (
                        <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute top-1/2 right-0 h-8 -translate-y-1/2 px-1 text-[11px] font-semibold tracking-[0.16em] text-muted uppercase transition hover:text-gold-300">
                          {showPassword ? 'Hide' : 'Show'}
                        </button>
                      )}
                      {touched && !fieldError && !isPassword && values[field.name] && <span className="absolute top-[18px] right-0 text-sm text-live">✓</span>}
                    </span>
                    {mode === 'register' && isPassword && values.password && <StrengthMeter password={values.password} />}
                  </Field>
                );
              })}
            </div>

            <Button type="submit" size="lg" disabled={submitting} className="w-full text-base active:scale-[0.985]">
              {submitting && <span className="size-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />}
              {submitting ? text.busy : text.submit}
            </Button>
          </form>

          {mode === 'login' && process.env.NODE_ENV === 'development' && (
            <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-line pt-5 text-sm text-muted">
              Dev quick login:
              {devAccounts.map(account => (
                <Button key={account.email} type="button" variant="secondary" size="sm" onClick={() => devLogin(account.email)}>
                  {account.label}
                </Button>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs leading-relaxed text-muted">Bids are binding once placed. Never share your password with anyone claiming to be BidNest.</p>
      </div>
    </div>
  );
};
