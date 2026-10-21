'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import { formatFullDate } from '../lib/time';
import type { User } from '../lib/types';
import { useAuth, useToast } from './Providers';
import { SaveBar, SettingsHeading, Switch } from './settings-controls';
import { Field, Input, Spinner, Textarea } from './ui';

interface ProfileValues {
  fullName: string;
  email: string;
  location: string;
  bio: string;
  isPublic: boolean;
}

const BIO_MAX = 300;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const toValues = (user: User): ProfileValues => ({ fullName: user.fullName, email: user.email, location: user.location ?? '', bio: user.bio ?? '', isPublic: user.isPublic });

const profileErrors = (values: ProfileValues): Partial<Record<keyof ProfileValues, string>> => ({
  fullName: values.fullName.trim() ? undefined : 'Enter your name',
  email: EMAIL.test(values.email.trim()) ? undefined : 'Enter a full email address, like name@domain.com',
});

const textFields = [
  { key: 'fullName', label: 'Display name', placeholder: 'Elena Marsh', type: 'text', autoComplete: 'name', hint: 'Shown on your profile and receipts' },
  { key: 'email', label: 'Email', placeholder: 'you@example.com', type: 'email', autoComplete: 'email', hint: 'Private. Used for alerts and receipts' },
  { key: 'location', label: 'Location', placeholder: 'City, country', type: 'text', autoComplete: 'address-level2', hint: 'Used for shipping estimates' },
] as const;

const initials = (name: string) =>
  name
    .split(' ')
    .map(word => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const ProfileForm = ({ user }: { user: User }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const saved = toValues(user);
  const [values, setValues] = useState(saved);
  const errors = profileErrors(values);
  const hasErrors = Object.values(errors).some(Boolean);
  const dirty = (Object.keys(saved) as (keyof ProfileValues)[]).some(key => values[key] !== saved[key]);
  const save = useMutation({
    mutationFn: () => api.patch<User>('/auth/me', { ...values, fullName: values.fullName.trim(), email: values.email.trim() }),
    onSuccess: updated => {
      queryClient.setQueryData(['me'], updated);
      setValues(toValues(updated));
      toast('success', 'Your profile is up to date.');
    },
    onError: error => toast('error', error.message),
  });

  return (
    <div className="flex flex-col gap-12">
      <SettingsHeading eyebrow="Profile" title="How the room sees you." text="Your name and username appear on bid ledgers. Your email stays private." />
      <div className="flex flex-wrap items-center gap-7 border-b border-line pb-10">
        <span className="grid size-28 flex-none place-items-center rounded-full border border-gold-300/40 bg-surface-3 shadow-[0_0_0_6px_rgb(231_211_147/0.06)]">
          <span className="display text-[40px] text-gold-300">{initials(values.fullName || '?')}</span>
        </span>
        <div className="flex flex-col gap-2.5">
          <p className="display text-[28px]">{values.fullName || 'Your name'}</p>
          <p className="text-[13px] text-muted">@{user.username} · member since {formatFullDate(user.createdAt)}</p>
          <p className="text-xs text-muted">Photo upload is not available yet, so your initials are used.</p>
        </div>
      </div>
      <div className="grid gap-x-10 gap-y-9 sm:grid-cols-2">
        <Field label="Username" hint="Usernames can't be changed">
          <Input value={user.username} readOnly aria-readonly className="text-text-2" />
        </Field>
        {textFields.map(field => (
          <Field key={field.key} label={field.label} error={errors[field.key]} hint={field.hint}>
            <Input type={field.type} value={values[field.key]} onChange={event => setValues({ ...values, [field.key]: event.target.value })} placeholder={field.placeholder} autoComplete={field.autoComplete} aria-invalid={Boolean(errors[field.key])} maxLength={field.key === 'location' ? 100 : undefined} />
          </Field>
        ))}
        <div className="sm:col-span-2">
          <Field label="Collector bio" hint={`${values.bio.length} / ${BIO_MAX}`}>
            <Textarea value={values.bio} onChange={event => setValues({ ...values, bio: event.target.value.slice(0, BIO_MAX) })} placeholder="What you collect, and why" />
          </Field>
        </div>
      </div>
      <div className="flex items-center justify-between gap-6 border-y border-line py-5">
        <div>
          <p className="text-[15px] font-semibold">Public collector profile</p>
          <p className="mt-1 text-[13px] text-muted">Show your bio and won lots to other members. Bid amounts are never shown.</p>
        </div>
        <Switch on={values.isPublic} onChange={isPublic => setValues({ ...values, isPublic })} label="Public collector profile" />
      </div>
      {dirty && <SaveBar text={hasErrors ? 'Fix the highlighted field to save' : 'You have unsaved profile changes'} saving={save.isPending} canSave={!hasErrors} onDiscard={() => setValues(saved)} onSave={() => save.mutate()} />}
    </div>
  );
};

export const SettingsProfile = () => {
  const { user } = useAuth();
  return user ? <ProfileForm user={user} /> : <Spinner />;
};
