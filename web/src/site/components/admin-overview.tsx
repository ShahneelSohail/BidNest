'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api, withQuery } from '../lib/api';
import type { AdminItem } from '../lib/admin';
import { formatMoney } from '../lib/format';
import { Ago, Async, AdminTitle, BidsChart, Icon, SectionHead, useAdminOverview, type IconName } from './admin';
import { lotNumber } from './ItemCard';
import { cx, Eyebrow, LinkButton } from './ui';

const QUEUE_PREVIEW = 5;

const feedStyles: Record<'bid' | 'user' | 'item', { icon: IconName; tone: string }> = {
  bid: { icon: 'gavel', tone: 'bg-gold-300/12 text-gold-300' },
  user: { icon: 'user', tone: 'bg-white/8 text-text-2' },
  item: { icon: 'item', tone: 'bg-info/12 text-info' },
};

const today = new Intl.DateTimeFormat('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

const PendingPreview = () => {
  const queue = useQuery({ queryKey: ['admin', 'approvals', 'preview'], queryFn: () => api.page<AdminItem>(withQuery('/admin/approvals', { pageSize: QUEUE_PREVIEW })) });
  return (
    <div>
      <SectionHead
        title="Pending approval"
        aside={
          <Link href="/admin/approvals" className="text-[13px] text-text-2 hover:text-gold-300">
            Open queue →
          </Link>
        }
      />
      <Async query={queue}>
        {({ items }) =>
          items.length === 0 ? (
            <p className="py-7 text-sm text-muted">Queue is clear. Nice work.</p>
          ) : (
            items.map(item => (
              <Link key={item.id} href="/admin/approvals" className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-4 border-b border-line-neutral py-3.5 transition hover:bg-gold-300/[0.03]">
                {item.primaryImage ? <img src={item.primaryImage} alt="" className="size-16 object-cover" /> : <span className="size-16 bg-surface-2" />}
                <span className="min-w-0">
                  <span className="block truncate text-[10.5px] font-semibold tracking-[0.2em] text-muted uppercase">
                    {lotNumber(item.id)} · {item.seller.username}
                  </span>
                  <span className="display mt-1 block truncate text-xl">{item.title}</span>
                </span>
                <span className="w-16 text-right text-xs text-muted">
                  <Ago at={item.createdAt} />
                </span>
              </Link>
            ))
          )
        }
      </Async>
    </div>
  );
};

export const AdminOverview = () => {
  const overview = useAdminOverview();
  return (
    <Async query={overview}>
      {({ stats, activity, bidsPerHour }) => {
        const kpis = [
          { label: 'Live auctions', value: stats.liveAuctions.toLocaleString('en-US'), hint: `${stats.soldItems} sold · ${stats.expiredItems} expired`, href: '/admin/listings', gold: false },
          { label: 'Total bids', value: stats.totalBids.toLocaleString('en-US'), hint: `${bidsPerHour.reduce((sum, count) => sum + count, 0)} in the last 24 hours`, href: '/admin/bids', gold: true },
          { label: 'Members', value: stats.totalUsers.toLocaleString('en-US'), hint: `${stats.blockedUsers} blocked`, href: '/admin/users', gold: false },
          { label: 'Pending approvals', value: stats.pendingApprovals.toLocaleString('en-US'), hint: `${stats.rejectedItems} rejected to date`, href: '/admin/approvals', gold: false },
        ];

        return (
          <div className="flex flex-col gap-12">
            <AdminTitle
              eyebrow={today.format(new Date())}
              title="The floor tonight."
              action={
                <LinkButton href="/admin/approvals" size="lg">
                  Review queue
                  <span className="tnum grid h-[22px] min-w-[22px] place-items-center rounded-full bg-ink px-1.5 text-xs text-gold-300">{stats.pendingApprovals}</span>
                </LinkButton>
              }
            />
            <div className="grid items-end gap-8 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))]">
              <div className="border-t border-gold-300/45 pt-[18px] sm:col-span-2 xl:col-span-1">
                <Eyebrow className="text-muted!">Revenue · sold lots</Eyebrow>
                <p className="display gold-text tnum mt-3 mb-2 text-6xl leading-[0.95] md:text-[80px]">{formatMoney(stats.totalRevenue)}</p>
                <p className="text-[13px] text-muted">{stats.soldItems} lots sold</p>
              </div>
              {kpis.map(kpi => (
                <Link key={kpi.label} href={kpi.href} className="group border-t border-line pt-[18px] transition hover:border-gold-300">
                  <Eyebrow className="text-muted!">{kpi.label}</Eyebrow>
                  <p className={cx('display tnum mt-3 mb-2 text-[44px] leading-none', kpi.gold && 'text-gold-300')}>{kpi.value}</p>
                  <p className="text-[12.5px] text-muted">{kpi.hint}</p>
                </Link>
              ))}
            </div>
            <div className="grid items-start gap-12 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              <div className="flex flex-col gap-10">
                <PendingPreview />
                <div>
                  <SectionHead title="Bids per hour" />
                  <div className="mt-4">
                    <BidsChart values={bidsPerHour} />
                  </div>
                </div>
              </div>
              <div>
                <SectionHead
                  title="Activity"
                  aside={
                    <span className="inline-flex items-center gap-2 text-[10.5px] font-semibold tracking-[0.16em] text-live uppercase">
                      <span className="live-dot size-1.5 rounded-full bg-current" />
                      Live
                    </span>
                  }
                />
                <div className="flex max-h-[560px] flex-col overflow-hidden">
                  {activity.map(entry => {
                    const style = feedStyles[entry.type];
                    return (
                      <Link key={`${entry.type}-${entry.at}-${entry.description}`} href={entry.link} className="rise -mx-2 grid grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-3 border-b border-line-neutral px-2 py-3 transition hover:bg-surface-2">
                        <span className={cx('grid size-7 place-items-center rounded-full', style.tone)}>
                          <Icon name={style.icon} size={13} />
                        </span>
                        <p className="text-[13.5px] leading-normal text-text-2">
                          <span className="font-medium text-text">{entry.user}</span> {entry.description} {entry.amount !== null && <span className="text-gold-300">{formatMoney(entry.amount)}</span>}
                        </p>
                        <span className="tnum text-[11.5px] whitespace-nowrap text-muted">
                          <Ago at={entry.at} />
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      }}
    </Async>
  );
};
