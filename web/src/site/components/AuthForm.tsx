'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useAuth } from './Providers';
import { Button, Card, ErrorState, Field, Input } from './ui';

type Mode = 'login' | 'register';

const copy = {
  login: { title: 'Welcome back', submit: 'Log in', switchText: "New to BidNest?", switchLink: '/register', switchLabel: 'Create an account' },
  register: { title: 'Create your account', submit: 'Sign up', switchText: 'Already registered?', switchLink: '/login', switchLabel: 'Log in' },
} as const;

const fields = {
  login: [
    { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
    { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' },
  ],
  register: [
    { name: 'fullName', label: 'Full name', type: 'text', autoComplete: 'name' },
    { name: 'username', label: 'Username', type: 'text', autoComplete: 'username' },
    { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
    { name: 'password', label: 'Password (8+ characters)', type: 'password', autoComplete: 'new-password' },
  ],
} as const;

export const AuthForm = ({ mode }: { mode: Mode }) => {
  const { login, register } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get('next');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const text = copy[mode];

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    setSubmitting(true);
    setError(null);
    try {
      const user = mode === 'login' ? await login({ email: values.email!, password: values.password! }) : await register({ email: values.email!, password: values.password!, username: values.username!, fullName: values.fullName! });
      router.replace(next?.startsWith('/') ? next : user.role === 'ADMIN' ? '/admin' : '/dashboard');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Something went wrong.');
      setSubmitting(false);
    }
  };

  return (
    <Card className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-semibold">{text.title}</h1>
      <form onSubmit={submit} className="space-y-4">
        {fields[mode].map(field => (
          <Field key={field.name} label={field.label}>
            <Input name={field.name} type={field.type} autoComplete={field.autoComplete} required />
          </Field>
        ))}
        {error && <ErrorState message={error} />}
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Please wait…' : text.submit}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {text.switchText}{' '}
        <Link href={text.switchLink} className="text-yellow hover:underline">
          {text.switchLabel}
        </Link>
      </p>
    </Card>
  );
};
