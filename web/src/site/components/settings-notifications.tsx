'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import { useToast } from './Providers';
import { NotAvailable, SaveBar, SettingsHeading, Switch } from './settings-controls';
import { cx, ErrorState, Spinner } from './ui';

const channels = ['email', 'push', 'sms'] as const;

type Channel = (typeof channels)[number];

interface PreferenceGroup {
  group: string;
  events: { key: string; label: string; channels: Record<Channel, boolean> }[];
}

type Matrix = Record<string, boolean>;

const cellKey = (event: string, channel: Channel) => `${event}:${channel}`;

const toMatrix = (groups: PreferenceGroup[]): Matrix =>
  Object.fromEntries(groups.flatMap(group => group.events.flatMap(event => channels.map(channel => [cellKey(event.key, channel), event.channels[channel]]))));

const PreferencesForm = ({ groups }: { groups: PreferenceGroup[] }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const saved = toMatrix(groups);
  const [matrix, setMatrix] = useState(saved);
  const changed = Object.keys(saved).filter(key => matrix[key] !== saved[key]);
  const save = useMutation({
    mutationFn: () =>
      api.put<PreferenceGroup[]>('/me/preferences', {
        preferences: changed.map(key => {
          const [event, channel] = key.split(':');
          return { event, channel, enabled: matrix[key] };
        }),
      }),
    onSuccess: updated => {
      queryClient.setQueryData(['preferences'], updated);
      setMatrix(toMatrix(updated));
      toast('success', 'Notification preferences updated.');
    },
    onError: error => toast('error', error.message),
  });
  const enabledCount = Object.entries(matrix).filter(([key, enabled]) => enabled && !key.endsWith(':sms')).length;

  return (
    <div className="flex flex-col gap-10">
      <SettingsHeading eyebrow="Notifications" title="Tell me when it matters." text="Choose how BidNest reaches you for each kind of event." />
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="h-11 border-b border-line-strong text-left text-[10.5px] font-semibold tracking-[0.18em] text-muted uppercase">Event</th>
            {channels.map(channel => (
              <th key={channel} className={cx('h-11 w-16 border-b border-line-strong text-center text-[10.5px] font-semibold tracking-[0.18em] uppercase sm:w-24', channel === 'sms' ? 'text-muted/50' : 'text-muted')}>
                {channel}
              </th>
            ))}
          </tr>
        </thead>
        {groups.map(group => (
          <tbody key={group.group}>
            <tr>
              <td colSpan={channels.length + 1} className="eyebrow pt-6 pb-2">
                {group.group}
              </td>
            </tr>
            {group.events.map(event => (
              <tr key={event.key}>
                <td className="border-b border-line-neutral py-3.5 pr-3 text-[15px] font-medium">{event.label}</td>
                {channels.map(channel => (
                  <td key={channel} className="border-b border-line-neutral text-center">
                    <span className="inline-grid h-11 w-11 place-items-center">
                      <Switch on={channel !== 'sms' && matrix[cellKey(event.key, channel)]} onChange={enabled => setMatrix({ ...matrix, [cellKey(event.key, channel)]: enabled })} label={`${event.label} by ${channel}`} disabled={channel === 'sms'} title={channel === 'sms' ? 'SMS alerts are not available yet' : undefined} />
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
      <NotAvailable>SMS alerts need a verified phone number, which is not available yet. Email digests and quiet hours are not available yet either.</NotAvailable>
      {changed.length > 0 && <SaveBar text={`Unsaved notification changes · ${enabledCount} alerts on`} saving={save.isPending} canSave onDiscard={() => setMatrix(saved)} onSave={() => save.mutate()} />}
    </div>
  );
};

export const SettingsNotifications = () => {
  const preferences = useQuery({ queryKey: ['preferences'], queryFn: () => api.get<PreferenceGroup[]>('/me/preferences'), staleTime: 0 });
  if (preferences.isPending) return <Spinner />;
  if (preferences.error) return <ErrorState message={preferences.error.message} />;
  return <PreferencesForm groups={preferences.data} />;
};
