'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { formatShortDate } from '../lib/time';
import { SectionHeading } from './dashboard';
import { Icon } from './dashboard-icons';
import { useToast } from './Providers';
import { Button, cx, ErrorState, Field, Input, Spinner, Textarea } from './ui';

interface ThreadReply {
  id: number;
  fromAdmin: boolean;
  author: string | null;
  body: string;
  createdAt: string;
}

interface MyMessage {
  id: number;
  subject: string;
  message: string;
  status: string;
  adminReply: string | null;
  repliedAt: string | null;
  createdAt: string;
  replies: ThreadReply[];
}

const NEW_REQUEST = 'new';
const MIN_MESSAGE = 10;

const awaitingUser = (message: MyMessage) => message.replies.at(-1)?.fromAdmin === true;

const statusLabel = (message: MyMessage) => (awaitingUser(message) ? 'Replied' : 'Open');

const StatusTag = ({ message, className }: { message: MyMessage; className?: string }) => (
  <span className={cx('inline-flex h-5 items-center rounded-full px-2 text-[9.5px] font-semibold tracking-[0.14em] uppercase', awaitingUser(message) ? 'bg-white/7 text-muted' : 'bg-info/12 text-info', className)}>{statusLabel(message)}</span>
);

const Bubble = ({ who, when, text, mine }: { who: string; when: string; text: string; mine: boolean }) => (
  <div className={cx('rise flex flex-col gap-1.5', mine ? 'items-end' : 'items-start')}>
    <span className={cx('text-[11px] font-semibold tracking-[0.06em]', mine ? 'text-text-2' : 'text-gold-300')}>
      {who} <span className="font-normal text-muted">· {when}</span>
    </span>
    <p className={cx('max-w-[88%] border px-4 py-3.5 text-sm leading-relaxed whitespace-pre-wrap md:max-w-[72%]', mine ? 'rounded-[12px_2px_12px_12px] border-line-neutral bg-surface-3' : 'rounded-[2px_12px_12px_12px] border-gold-300/20 bg-surface-2')}>{text}</p>
  </div>
);

const ReplyForm = ({ messageId }: { messageId: number }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const send = useMutation({
    mutationFn: () => api.post(`/me/messages/${messageId}/replies`, { body }),
    onSuccess: async () => {
      setBody('');
      await queryClient.invalidateQueries({ queryKey: ['my-messages'] });
    },
    onError: error => toast('error', error.message),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (body.trim()) send.mutate();
  };

  return (
    <form onSubmit={submit} className="flex items-end gap-3 border-t border-line p-4 md:px-7">
      <textarea
        value={body}
        onChange={event => setBody(event.target.value)}
        placeholder="Write a reply"
        maxLength={2000}
        aria-label="Reply"
        className="h-20 flex-1 resize-none rounded-sm border border-line-strong bg-surface px-3.5 py-3 text-sm leading-relaxed text-text outline-none transition placeholder:text-muted focus:border-gold-300"
      />
      <Button type="submit" variant="gold" disabled={!body.trim() || send.isPending}>
        {send.isPending ? 'Sending…' : 'Send'}
      </Button>
    </form>
  );
};

const NewRequestForm = ({ onSent }: { onSent: () => void }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const send = useMutation({
    mutationFn: () => api.post('/contact', { subject, message }),
    onSuccess: async () => {
      toast('success', 'Request sent. We reply within one business day.');
      await queryClient.invalidateQueries({ queryKey: ['my-messages'] });
      onSent();
    },
    onError: error => toast('error', error.message),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    send.mutate();
  };

  return (
    <form onSubmit={submit} className="flex max-w-xl flex-col gap-6 p-6 md:p-8">
      <p className="display text-2xl">New request</p>
      <Field label="Subject">
        <Input value={subject} onChange={event => setSubject(event.target.value)} maxLength={200} required />
      </Field>
      <Field label="Message" hint={`At least ${MIN_MESSAGE} characters`}>
        <Textarea value={message} onChange={event => setMessage(event.target.value)} maxLength={2000} required />
      </Field>
      <Button className="self-start" disabled={send.isPending || !subject.trim() || message.trim().length < MIN_MESSAGE}>
        {send.isPending ? 'Sending…' : 'Send request'}
      </Button>
    </form>
  );
};

export const MyMessages = () => {
  const messages = useQuery({ queryKey: ['my-messages'], queryFn: () => api.get<MyMessage[]>('/me/messages') });
  const [selected, setSelected] = useState<number | typeof NEW_REQUEST | null>(null);

  if (messages.isPending) return <Spinner />;
  if (messages.error) return <ErrorState message={messages.error.message} />;
  const threads = messages.data;
  const composing = selected === NEW_REQUEST || threads.length === 0;
  const current = composing ? undefined : (threads.find(thread => thread.id === selected) ?? threads[0]);

  return (
    <>
      <SectionHeading
        eyebrow="Support"
        title="Messages"
        aside={
          <Button variant="secondary" className="pr-5 pl-4" onClick={() => setSelected(NEW_REQUEST)}>
            <Icon name="plus" size={15} />
            New request
          </Button>
        }
      />
      <div className="grid min-h-[480px] border border-line md:h-[680px] md:grid-cols-[320px_minmax(0,1fr)]">
        <div className="max-h-64 overflow-y-auto border-b border-line md:max-h-none md:border-r md:border-b-0">
          {threads.length === 0 && <p className="p-5 text-sm text-muted">No conversations yet.</p>}
          {threads.map(thread => {
            const on = current?.id === thread.id;
            return (
              <button key={thread.id} onClick={() => setSelected(thread.id)} className={cx('flex w-full flex-col gap-1.5 border-b border-line-neutral px-5 py-[18px] text-left shadow-[inset_2px_0_0_transparent] transition hover:bg-surface-2', on && 'bg-surface-2 shadow-[inset_2px_0_0_var(--color-gold-300)]')}>
                <span className="flex items-center justify-between gap-2">
                  <span className={cx('truncate text-sm', on ? 'font-semibold' : 'font-medium')}>{thread.subject}</span>
                  <span className="flex-none text-[11px] text-muted">{formatShortDate(thread.createdAt)}</span>
                </span>
                <span className="truncate text-[13px] text-muted">{thread.replies.length ? `${thread.replies.at(-1)!.fromAdmin ? 'Support' : 'You'}: ${thread.replies.at(-1)!.body}` : `You: ${thread.message}`}</span>
                <StatusTag message={thread} className="self-start" />
              </button>
            );
          })}
        </div>
        <div className="flex min-w-0 flex-col">
          {composing && <NewRequestForm onSent={() => setSelected(null)} />}
          {current && (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-[18px] md:px-7">
                <div className="min-w-0">
                  <p className="display truncate text-2xl">{current.subject}</p>
                  <p className="mt-1 text-xs text-muted">Ticket #{current.id}</p>
                </div>
                <StatusTag message={current} className="h-6 px-2.5 text-[10px]" />
              </div>
              <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6 md:p-7">
                <Bubble who="You" when={formatDateTime(current.createdAt)} text={current.message} mine />
                {current.replies.map(entry => (
                  <Bubble key={entry.id} who={entry.fromAdmin ? 'BidNest Support' : 'You'} when={formatDateTime(entry.createdAt)} text={entry.body} mine={!entry.fromAdmin} />
                ))}
                {current.replies.length === 0 && <p className="text-sm text-muted">We have your message and will reply here soon.</p>}
              </div>
              <ReplyForm key={current.id} messageId={current.id} />
            </>
          )}
        </div>
      </div>
    </>
  );
};
