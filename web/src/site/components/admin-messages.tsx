'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { api, withQuery } from '../lib/api';
import { initials, type AdminMessage, type MessageStatus, type MessagesMeta } from '../lib/admin';
import { formatDateTime } from '../lib/format';
import { Ago, Async, AdminTitle, Avatar, ConfirmButton, FilterChips, Pill, type PillTone, useAdminMutation } from './admin';
import { Button, cx, EmptyState, Eyebrow, Pagination } from './ui';

const MESSAGES_PAGE_SIZE = 20;
const CANNED_REPLIES = [
  { label: 'Thanks, looking into it', text: 'Thanks for getting in touch. We are looking into this and will come back to you shortly.' },
  { label: 'Payment help', text: 'Thanks for reaching out. Payments for won lots are completed from your dashboard under Won auctions. Let us know if the option is missing and we will check your account.' },
  { label: 'Listing feedback', text: 'Thanks for your submission. We reviewed your listing and need a little more detail before it can go live. Please update the description and photos and resubmit.' },
  { label: 'Resolved', text: 'We have resolved this on our side. Please let us know if you run into anything else.' },
];

const statusTones: Record<MessageStatus, PillTone> = { new: 'gold', read: 'neutral', replied: 'live', archived: 'info' };
const statusFilters: { key: 'all' | MessageStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'read', label: 'Read' },
  { key: 'replied', label: 'Replied' },
  { key: 'archived', label: 'Archived' },
];
const bulkActions = [
  { action: 'read', label: 'Mark read' },
  { action: 'archive', label: 'Archive' },
] as const;

const Bubble = ({ align, who, at, tone, children }: { align: 'left' | 'right'; who: string; at: string; tone: 'user' | 'admin'; children: ReactNode }) => (
  <div className={cx('rise flex flex-col gap-1.5', align === 'right' ? 'items-end' : 'items-start')}>
    <span className={cx('text-[11px] font-semibold', tone === 'admin' ? 'text-gold-300' : 'text-text')}>
      {who} <span className="font-normal text-muted">· {formatDateTime(at)}</span>
    </span>
    <p className={cx('max-w-[78%] border px-4 py-3 text-sm leading-relaxed whitespace-pre-line', tone === 'admin' ? 'rounded-[12px_12px_2px_12px] border-gold-300/30 bg-gold-300/10' : 'rounded-[12px_12px_12px_2px] border-line bg-surface-2')}>{children}</p>
  </div>
);

const Thread = ({ message }: { message: AdminMessage }) => {
  const [draft, setDraft] = useState('');
  const reply = useAdminMutation(() => api.post(`/admin/messages/${message.id}/reply`, { replyContent: draft }), 'Reply sent.');
  const setStatus = useAdminMutation((status: string) => api.patch(`/admin/messages/${message.id}/status`, { status }));
  const remove = useAdminMutation(() => api.delete(`/admin/messages/${message.id}`), 'Message deleted.');
  const archived = message.status === 'archived';

  const send = (event?: FormEvent) => {
    event?.preventDefault();
    if (draft.trim() && !reply.isPending) reply.mutate(undefined, { onSuccess: () => setDraft('') });
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
        <div className="min-w-0">
          <p className="display truncate text-[22px]">{message.subject}</p>
          <p className="mt-0.5 truncate text-xs text-muted">
            #BN-{message.id} · {message.email}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="secondary" disabled={setStatus.isPending} onClick={() => setStatus.mutate(archived ? (message.adminReply ? 'REPLIED' : 'READ') : 'ARCHIVED')}>
            {archived ? 'Reopen' : 'Archive'}
          </Button>
          <ConfirmButton label="Delete" prompt="Delete thread?" confirmLabel="Delete" disabled={remove.isPending} onConfirm={() => remove.mutate()} />
        </div>
      </div>
      <div className="flex min-h-48 flex-1 flex-col gap-4 overflow-y-auto p-6">
        <Bubble align="left" who={message.name} at={message.createdAt} tone="user">
          {message.message}
        </Bubble>
        {message.adminReply && message.repliedAt && (
          <Bubble align="right" who={message.repliedBy ?? 'You'} at={message.repliedAt} tone="admin">
            {message.adminReply}
          </Bubble>
        )}
      </div>
      <form onSubmit={send} className="flex flex-col gap-3 border-t border-line px-5 pt-3.5 pb-[18px]">
        <div className="flex gap-1.5 overflow-x-auto">
          {CANNED_REPLIES.map(canned => (
            <button key={canned.label} type="button" onClick={() => setDraft(current => (current ? `${current}\n${canned.text}` : canned.text))} className="h-8 shrink-0 rounded-full border border-line-strong px-3 text-xs font-medium text-text-2 transition hover:border-gold-300 hover:text-gold-300">
              {canned.label}
            </button>
          ))}
        </div>
        <textarea
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => (event.metaKey || event.ctrlKey) && event.key === 'Enter' && send()}
          placeholder={message.adminReply ? 'Send a follow-up reply' : `Reply to ${message.name}`}
          maxLength={2000}
          className="h-24 resize-none rounded-sm border border-line-strong bg-surface px-3.5 py-3 text-sm leading-relaxed text-text outline-none transition placeholder:text-muted focus:border-gold-300"
        />
        <div className="flex items-center gap-3">
          <span className="flex-1 text-[11.5px] text-muted">Ctrl or ⌘ + Enter to send</span>
          <Button type="submit" variant="gold" size="sm" disabled={!draft.trim() || reply.isPending}>
            Send reply
          </Button>
        </div>
      </form>
    </div>
  );
};

const Sender = ({ message }: { message: AdminMessage }) => (
  <div className="hidden flex-col gap-5 overflow-y-auto border-l border-line p-6 xl:flex">
    <div className="flex flex-col items-start gap-2.5">
      <span className="display grid size-[52px] place-items-center rounded-full border border-line-strong bg-surface-3 text-[19px] text-gold-300">{initials(message.name)}</span>
      <div>
        <p className="display text-[22px]">{message.name}</p>
        <a href={`mailto:${message.email}`} className="text-xs break-all text-muted hover:text-gold-300">
          {message.email}
        </a>
      </div>
      <Pill tone={statusTones[message.status]}>{message.status}</Pill>
    </div>
    <div className="flex flex-col gap-1.5 text-[13px]">
      <Eyebrow className="mb-1 text-muted!">Details</Eyebrow>
      <span className="text-text-2">{message.userId ? `Registered member #${message.userId}` : 'Guest visitor'}</span>
      <span className="text-muted">Received {formatDateTime(message.createdAt)}</span>
      {message.repliedAt && <span className="text-muted">Replied {formatDateTime(message.repliedAt)}</span>}
    </div>
  </div>
);

export const Messages = () => {
  const [status, setStatus] = useState<'all' | MessageStatus>('all');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [checked, setChecked] = useState(new Set<number>());
  const messages = useQuery({
    queryKey: ['admin', 'messages', status, page],
    queryFn: async () => {
      const { items, meta } = await api.page<AdminMessage>(withQuery('/admin/messages', { status, page, pageSize: MESSAGES_PAGE_SIZE }));
      return { items, meta: meta as MessagesMeta };
    },
    placeholderData: previous => previous,
  });
  const markRead = useAdminMutation((id: number) => api.patch(`/admin/messages/${id}/status`, { status: 'READ' }));
  const bulk = useAdminMutation(({ action }: { action: 'read' | 'archive' | 'delete' }) => api.post('/admin/messages/bulk', { ids: [...checked], action }), 'Messages updated.');

  const runBulk = (action: 'read' | 'archive' | 'delete') => bulk.mutate({ action }, { onSuccess: () => setChecked(new Set()) });
  const toggleChecked = (id: number) =>
    setChecked(current => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-6">
      <AdminTitle eyebrow="Support inbox" title="Messages" />
      <Async query={messages}>
        {({ items, meta }) => {
          const counts = meta.counts;
          const selected = items.find(message => message.id === selectedId);
          const options = statusFilters.map(filter => ({ ...filter, count: filter.key === 'all' ? Object.values(counts).reduce((sum, count) => sum + count, 0) : (counts[filter.key] ?? 0) }));

          return (
            <div className="grid border border-line lg:h-[760px] lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_260px]">
              <div className="flex max-h-[480px] min-h-0 flex-col border-b border-line lg:max-h-none lg:border-r lg:border-b-0">
                <div className="border-b border-line p-4">
                  <FilterChips
                    options={options}
                    value={status}
                    onChange={key => {
                      setStatus(key);
                      setPage(1);
                      setChecked(new Set());
                    }}
                  />
                </div>
                {checked.size > 0 && (
                  <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 px-4 py-2.5">
                    <span className="tnum mr-auto text-xs text-text-2">{checked.size} selected</span>
                    {bulkActions.map(entry => (
                      <Button key={entry.action} size="sm" variant="secondary" disabled={bulk.isPending} onClick={() => runBulk(entry.action)}>
                        {entry.label}
                      </Button>
                    ))}
                    <ConfirmButton label="Delete" prompt="Delete selected?" confirmLabel="Delete" disabled={bulk.isPending} onConfirm={() => runBulk('delete')} />
                  </div>
                )}
                <div className="flex-1 overflow-y-auto">
                  {items.length === 0 && <p className="px-5 py-10 text-center text-[13px] text-muted">Nothing here.</p>}
                  {items.map(message => (
                    <div key={message.id} className={cx('flex items-start gap-1 border-b border-l-2 border-b-line-neutral pl-3 transition hover:bg-surface-2', message.id === selected?.id ? 'border-l-gold-300 bg-surface-2' : 'border-l-transparent')}>
                      <input type="checkbox" aria-label={`Select message from ${message.name}`} checked={checked.has(message.id)} onChange={() => toggleChecked(message.id)} className="mt-[22px] size-4 shrink-0 accent-gold-300" />
                      <button
                        onClick={() => {
                          setSelectedId(message.id);
                          if (message.status === 'new') markRead.mutate(message.id);
                        }}
                        className="grid min-w-0 flex-1 grid-cols-[36px_minmax(0,1fr)] gap-3 py-4 pr-5 pl-2 text-left"
                      >
                        <span className="relative">
                          <Avatar name={message.name} />
                          {message.status === 'new' && <span className="absolute top-0 right-0 size-[9px] rounded-full bg-gold-300 shadow-[0_0_0_2px_var(--color-ink)]" />}
                        </span>
                        <span className="flex min-w-0 flex-col gap-1">
                          <span className="flex justify-between gap-2">
                            <span className="truncate text-[13px] font-semibold">{message.name}</span>
                            <span className="shrink-0 text-[11px] text-muted">
                              <Ago at={message.createdAt} />
                            </span>
                          </span>
                          <span className={cx('truncate text-[13.5px]', message.status === 'new' && 'font-semibold')}>{message.subject}</span>
                          <span className="truncate text-[12.5px] text-muted">{message.message}</span>
                          <span>
                            <Pill tone={statusTones[message.status]}>{message.status}</Pill>
                          </span>
                        </span>
                      </button>
                    </div>
                  ))}
                  <div className="pb-4 [&>div]:mt-4">
                    <Pagination meta={meta} onChange={setPage} />
                  </div>
                </div>
              </div>
              {selected ? (
                <>
                  <Thread key={selected.id} message={selected} />
                  <Sender message={selected} />
                </>
              ) : (
                <div className="grid min-h-48 place-items-center p-6 lg:col-span-1 xl:col-span-2">
                  <EmptyState title="Select a conversation" hint="Pick a message on the left to read it and reply." />
                </div>
              )}
            </div>
          );
        }}
      </Async>
    </div>
  );
};
