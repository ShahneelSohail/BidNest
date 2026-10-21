'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import { Icon } from './dashboard-icons';
import { NotAvailable, SettingsHeading } from './settings-controls';
import { Button, cx } from './ui';

type PasswordField = 'current' | 'next' | 'confirm';

const MIN_LENGTH = 8;

const passwordFields: { key: PasswordField; label: string; autoComplete: string }[] = [
  { key: 'current', label: 'Current password', autoComplete: 'current-password' },
  { key: 'next', label: 'New password', autoComplete: 'new-password' },
  { key: 'confirm', label: 'Confirm new password', autoComplete: 'new-password' },
];

const strengthLabels = ['', 'Too short', 'Weak', 'Good', 'Strong'];
const strengthColors = ['bg-white/10', 'bg-danger', 'bg-outbid', 'bg-gold-400', 'bg-live'];
const strengthText = ['text-muted', 'text-danger', 'text-outbid', 'text-gold-400', 'text-live'];

const strengthOf = (password: string) => (password ? (password.length < MIN_LENGTH ? 1 : 1 + [/[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(rule => rule.test(password)).length) : 0);

const passwordErrors = ({ current, next, confirm }: Record<PasswordField, string>) => ({
  current: current ? undefined : 'Enter your current password',
  next: next.length < MIN_LENGTH ? `Use at least ${MIN_LENGTH} characters` : next === current ? 'Choose a password you haven’t used here' : undefined,
  confirm: confirm === next ? undefined : 'Passwords don’t match',
});

const empty: Record<PasswordField, string> = { current: '', next: '', confirm: '' };

export const SettingsSecurity = () => {
  const [values, setValues] = useState(empty);
  const [shown, setShown] = useState<PasswordField[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [done, setDone] = useState(false);
  const change = useMutation({
    mutationFn: () => api.post('/auth/change-password', { currentPassword: values.current, newPassword: values.next }),
    onSuccess: () => {
      setValues(empty);
      setAttempted(false);
      setDone(true);
    },
  });
  const errors: Partial<Record<PasswordField, string>> = attempted ? passwordErrors(values) : {};
  const strength = strengthOf(values.next);
  const rules = [
    { text: `${MIN_LENGTH} or more characters`, ok: values.next.length >= MIN_LENGTH },
    { text: 'A number', ok: /[0-9]/.test(values.next) },
    { text: 'A symbol', ok: /[^A-Za-z0-9]/.test(values.next) },
    { text: 'Both entries match', ok: Boolean(values.next) && values.next === values.confirm },
  ];

  const submit = () => {
    setDone(false);
    change.reset();
    if (Object.values(passwordErrors(values)).some(Boolean)) return setAttempted(true);
    change.mutate();
  };

  return (
    <div className="flex flex-col gap-10">
      <SettingsHeading eyebrow="Security" title="Change password." text="Pick something you don’t use anywhere else." />
      {done && (
        <div role="status" className="rise flex items-center gap-3 border border-live/30 bg-live/6 px-4 py-3.5 text-sm">
          <span className="text-live">
            <Icon name="check" size={18} strokeWidth={2} />
          </span>
          <span>
            <b className="text-live">Password updated.</b> Use the new one next time you sign in.
          </span>
        </div>
      )}
      {change.error && (
        <div role="alert" className="flex items-center gap-3 border border-danger/35 bg-danger/6 px-4 py-3.5 text-sm">
          <b className="text-danger">{change.error.message}</b>
        </div>
      )}
      <form
        onSubmit={event => {
          event.preventDefault();
          submit();
        }}
        className="grid items-start gap-10 md:grid-cols-[minmax(0,1fr)_260px]"
      >
        <div className="flex flex-col gap-8">
          {passwordFields.map(field => {
            const error = errors[field.key];
            const visible = shown.includes(field.key);
            return (
              <label key={field.key} className="flex flex-col gap-1">
                <span className={cx('text-[11px] font-semibold tracking-[0.22em] uppercase', error ? 'text-danger' : 'text-muted')}>{field.label}</span>
                <div className="relative">
                  <input
                    type={visible ? 'text' : 'password'}
                    value={values[field.key]}
                    onChange={event => {
                      setDone(false);
                      setValues({ ...values, [field.key]: event.target.value });
                    }}
                    autoComplete={field.autoComplete}
                    aria-invalid={Boolean(error)}
                    className={cx('h-[52px] w-full border-0 border-b bg-transparent pr-14 text-lg text-text outline-none transition focus:border-gold-300', error ? 'border-danger' : values[field.key] ? 'border-gold-300/45' : 'border-line-strong')}
                  />
                  <button type="button" onClick={() => setShown(current => (visible ? current.filter(key => key !== field.key) : [...current, field.key]))} className="absolute top-2.5 right-0 h-8 text-[11px] font-semibold tracking-[0.16em] text-muted uppercase transition hover:text-gold-300">
                    {visible ? 'Hide' : 'Show'}
                  </button>
                </div>
                {error && (
                  <span role="alert" className="mt-1.5 text-[13px] text-danger">
                    {error}
                  </span>
                )}
                {field.key === 'next' && values.next && (
                  <div className="mt-2.5 flex items-center gap-3">
                    <div className="grid flex-1 grid-cols-4 gap-1">
                      {[1, 2, 3, 4].map(segment => (
                        <span key={segment} className={cx('h-0.5 transition-colors duration-[240ms]', segment <= strength ? strengthColors[strength] : 'bg-white/10')} />
                      ))}
                    </div>
                    <span className={cx('min-w-16 text-right text-xs', strengthText[strength])}>{strengthLabels[strength]}</span>
                  </div>
                )}
              </label>
            );
          })}
          <Button size="lg" className="self-start" disabled={change.isPending}>
            {change.isPending ? 'Updating…' : 'Update password'}
          </Button>
        </div>
        <div className="flex flex-col gap-3 border border-line bg-surface p-5">
          <p className="text-[10.5px] font-semibold tracking-[0.2em] text-muted uppercase">Requirements</p>
          {rules.map(rule => (
            <div key={rule.text} className={cx('flex items-center gap-2.5 text-[13px] transition-colors', rule.ok ? 'text-text' : 'text-muted')}>
              <span className={cx('grid size-[18px] place-items-center rounded-full border text-ink transition', rule.ok ? 'border-live bg-live' : 'border-white/20')}>{rule.ok && <Icon name="check" size={10} strokeWidth={3} />}</span>
              {rule.text}
            </div>
          ))}
        </div>
      </form>
      <div className="flex flex-col gap-4 pt-4">
        <h2 className="display border-b border-line-strong pb-3 text-[28px]">Where you&apos;re signed in</h2>
        <NotAvailable>A list of active sessions, and signing out of other devices, is not available yet.</NotAvailable>
      </div>
    </div>
  );
};
