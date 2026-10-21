'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '../lib/api';
import { dayGroup, timeAgo } from '../lib/time';
import type { AppNotification } from '../lib/types';
import { SectionHeading } from './dashboard';
import { Icon } from './dashboard-icons';
import { Button, cx, EmptyState, ErrorState, LinkButton, Spinner } from './ui';

const filters = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
] as const;

type Filter = (typeof filters)[number]['key'];

const dayOrder = ['Today', 'Yesterday', 'Earlier'] as const;

export const Notifications = () => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const notifications = useQuery({ queryKey: ['notifications'], queryFn: () => api.page<AppNotification>('/me/notifications?pageSize=50') });
  const refresh = () => queryClient.invalidateQueries();
  const markAll = useMutation({ mutationFn: () => api.post('/me/notifications/read-all'), onSuccess: refresh });
  const markOne = useMutation({ mutationFn: (id: number) => api.patch(`/me/notifications/${id}/read`), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: number) => api.delete(`/me/notifications/${id}`), onSuccess: refresh });

  if (notifications.isPending) return <Spinner />;
  if (notifications.error) return <ErrorState message={notifications.error.message} />;
  const { items } = notifications.data;
  const unread = items.filter(item => !item.isRead).length;
  const counts = { all: items.length, unread };
  const visible = filter === 'unread' ? items.filter(item => !item.isRead) : items;

  return (
    <div className="max-w-3xl">
      <SectionHeading eyebrow={unread ? `${unread} unread` : 'All caught up'} title="Notifications" />
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {filters.map(option => (
            <button key={option.key} aria-pressed={filter === option.key} onClick={() => setFilter(option.key)} className={cx('flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition', filter === option.key ? 'border-gold-300 bg-gold-300/12 text-gold-300' : 'border-line-strong text-text hover:border-gold-300')}>
              {option.label}
              <span className="tnum text-[11px] text-muted">{counts[option.key]}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={!unread || markAll.isPending} onClick={() => markAll.mutate()}>
            Mark all read
          </Button>
          <LinkButton href="/settings/notifications" variant="ghost" size="sm">
            Preferences
          </LinkButton>
        </div>
      </div>
      {visible.length === 0 && <EmptyState title={filter === 'unread' ? 'Nothing unread' : "You're all caught up"} hint="New bids, wins and replies from support land here." />}
      {dayOrder.map(day => {
        const group = visible.filter(item => dayGroup(item.createdAt) === day);
        return (
          group.length > 0 && (
            <section key={day} className="mb-8">
              <p className="border-b border-line-strong pb-2.5 text-[11px] font-semibold tracking-[0.22em] text-muted uppercase">{day}</p>
              {group.map(item => (
                <div key={item.id} className={cx('-mx-3 grid grid-cols-[40px_minmax(0,1fr)_auto] items-start gap-4 border-b border-line-neutral px-3 py-[18px] transition hover:bg-gold-300/5', !item.isRead && 'bg-gold-300/[0.03]')}>
                  <span className="grid size-10 place-items-center rounded-full bg-gold-300/12 text-gold-300">
                    <Icon name="bell" size={16} strokeWidth={1.6} />
                  </span>
                  <div className="min-w-0">
                    <p className={cx('flex items-center gap-2 text-[15px]', item.isRead ? 'font-medium' : 'font-semibold')}>
                      {item.title}
                      {!item.isRead && <span className="size-2 rounded-full bg-gold-300" aria-label="Unread" />}
                    </p>
                    <p className="mt-1 text-sm leading-normal text-text-2">{item.message}</p>
                    <p className="mt-1.5 text-xs text-muted">{timeAgo(item.createdAt)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {item.link && (
                      <Link href={item.link} onClick={() => !item.isRead && markOne.mutate(item.id)} className="inline-flex h-9 items-center rounded-full border border-line-strong px-3.5 text-[13px] font-medium whitespace-nowrap transition hover:border-gold-300 hover:text-gold-300">
                        View
                      </Link>
                    )}
                    <div className="flex">
                      {!item.isRead && (
                        <Button variant="ghost" size="sm" className="px-2" onClick={() => markOne.mutate(item.id)}>
                          Mark read
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="px-2" onClick={() => remove.mutate(item.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )
        );
      })}
    </div>
  );
};
