'use client';

import { Button, cx } from './ui';

export const Switch = ({ on, onChange, label, disabled, title }: { on: boolean; onChange: (on: boolean) => void; label: string; disabled?: boolean; title?: string }) => (
  <button
    role="switch"
    aria-checked={on}
    aria-label={label}
    title={title}
    disabled={disabled}
    onClick={() => onChange(!on)}
    className={cx('relative h-[26px] w-11 flex-none rounded-full border transition-colors duration-[240ms] disabled:cursor-not-allowed disabled:opacity-35', on ? 'border-gold-300 bg-gold-300' : 'border-white/12 bg-surface-3')}
  >
    <span className={cx('absolute top-[3px] left-[3px] size-[18px] rounded-full transition-transform duration-[240ms] ease-[var(--ease-expo)]', on ? 'translate-x-[18px] bg-ink' : 'bg-muted')} />
  </button>
);

export const SaveBar = ({ text, saving, canSave, onDiscard, onSave }: { text: string; saving: boolean; canSave: boolean; onDiscard: () => void; onSave: () => void }) => (
  <div className="pointer-events-none fixed inset-x-0 bottom-8 z-30 flex justify-center px-4">
    <div role="status" className="rise pointer-events-auto flex w-full max-w-[640px] items-center gap-3 rounded-full border border-line-strong bg-surface-3 py-3 pr-3 pl-6 shadow-e2">
      <span className="size-2 flex-none rounded-full bg-gold-300" />
      <span className="flex-1 text-sm">{text}</span>
      <Button variant="ghost" size="sm" onClick={onDiscard} disabled={saving}>
        Discard
      </Button>
      <Button onClick={onSave} disabled={!canSave || saving}>
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  </div>
);

export const SettingsHeading = ({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) => (
  <div>
    <p className="eyebrow mb-3">{eyebrow}</p>
    <h1 className="display text-5xl leading-none md:text-6xl">{title}</h1>
    <p className="mt-3.5 text-[15px] leading-relaxed text-text-2">{text}</p>
  </div>
);

export const NotAvailable = ({ children }: { children: string }) => <p className="border border-dashed border-line-strong px-5 py-4 text-[13px] leading-relaxed text-muted">{children}</p>;
