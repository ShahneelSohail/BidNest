'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import { formatFullDate } from '../lib/time';
import type { User } from '../lib/types';
import { useAuth, useToast } from './Providers';
import { SaveBar, SettingsHeading, Switch } from './settings-controls';
import { Avatar, Button, cx, Field, Input, Spinner, Textarea } from './ui';

interface ProfileValues {
  fullName: string;
  email: string;
  location: string;
  bio: string;
  isPublic: boolean;
}

const BIO_MAX = 300;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
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

  const savePhoto = (updated: User, message: string) => {
    queryClient.setQueryData(['me'], updated);
    toast('success', message);
  };
  const photo = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('avatar', file);
      return api.post<User>('/auth/me/avatar', form);
    },
    onSuccess: updated => savePhoto(updated, 'Photo updated.'),
    onError: error => toast('error', error.message),
  });
  const removePhoto = useMutation({
    mutationFn: () => api.delete<User>('/auth/me/avatar'),
    onSuccess: updated => savePhoto(updated, 'Photo removed.'),
    onError: error => toast('error', error.message),
  });
  const chooseFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES) return toast('error', 'Choose an image under 5 MB.');
    photo.mutate(file);
  };

  return (
    <div className="flex flex-col gap-12">
      <SettingsHeading eyebrow="Profile" title="How the room sees you." text="Your name and username appear on bid ledgers. Your email stays private." />
      <div className="flex flex-wrap items-center gap-7 border-b border-line pb-10">
        <Avatar name={values.fullName || '?'} src={user.avatarUrl} className="display size-28 flex-none border border-gold-300/40 bg-surface-3 text-[40px] text-gold-300 shadow-[0_0_0_6px_rgb(231_211_147/0.06)]" />
        <div className="flex flex-col gap-2.5">
          <p className="display text-[28px]">{values.fullName || 'Your name'}</p>
          <p className="text-[13px] text-muted">@{user.username} · member since {formatFullDate(user.createdAt)}</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className={cx('inline-flex h-9 cursor-pointer items-center rounded-full border border-line-strong px-4 text-[13px] font-semibold text-gold-300 transition hover:bg-gold-300 hover:text-ink', photo.isPending && 'pointer-events-none opacity-50')}>
              {photo.isPending ? 'Uploading…' : user.avatarUrl ? 'Change photo' : 'Upload photo'}
              <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="sr-only" aria-label="Upload photo" onChange={event => chooseFile(event.target.files?.[0])} />
            </label>
            {user.avatarUrl && (
              <Button variant="ghost" size="sm" disabled={photo.isPending} onClick={() => removePhoto.mutate()}>
                Remove
              </Button>
            )}
            <span className="text-xs text-muted">JPG, PNG, GIF or WebP, up to 5 MB</span>
          </div>
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
