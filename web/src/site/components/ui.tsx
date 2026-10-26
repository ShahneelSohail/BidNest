import Link from 'next/link';
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import type { PageMeta } from '../lib/api';
import type { ItemStatus } from '../lib/types';

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

const buttonStyles = {
  primary: 'bg-white text-ink hover:bg-gold-300',
  gold: 'bg-gold-300 text-ink hover:bg-gold-100',
  secondary: 'border border-line-strong text-gold-300 hover:bg-gold-300 hover:text-ink',
  danger: 'border border-danger/50 text-danger hover:bg-danger hover:text-ink',
  ghost: 'text-text-2 hover:text-gold-300',
} as const;

const buttonSizes = { md: 'h-11 px-6 text-sm', sm: 'h-9 px-4 text-[13px]', lg: 'h-14 px-8 text-[15px]' } as const;

type Variant = keyof typeof buttonStyles;
type Size = keyof typeof buttonSizes;

const buttonBase = 'inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition duration-200 disabled:cursor-not-allowed disabled:opacity-45';
const buttonClass = (variant: Variant, size: Size, className?: string) => cx(buttonBase, buttonStyles[variant], buttonSizes[size], className);

export const Button = ({ variant = 'primary', size = 'md', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) => (
  <button className={buttonClass(variant, size, className)} {...props} />
);

export const LinkButton = ({ href, variant = 'primary', size = 'md', className, children }: { href: string; variant?: Variant; size?: Size; className?: string; children: ReactNode }) => (
  <Link href={href} className={buttonClass(variant, size, className)}>
    {children}
  </Link>
);

const underline = 'w-full h-12 border-0 border-b border-line-strong bg-transparent px-0 text-base text-text placeholder:text-muted outline-none transition focus:border-gold-300 focus:shadow-[0_1px_0_var(--color-gold-300)] aria-[invalid=true]:border-danger';

export const Field = ({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) => (
  <label className="block space-y-1">
    <span className={cx('text-[11px] font-semibold tracking-[0.2em] uppercase', error ? 'text-danger' : 'text-text-2')}>{label}</span>
    {children}
    {error ? <span className="block text-xs text-danger">{error}</span> : hint && <span className="block text-xs text-muted">{hint}</span>}
  </label>
);

export const Input = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => <input className={cx(underline, className)} {...props} />;
export const Select = ({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) => <select className={cx(underline, 'bg-ink', className)} {...props} />;
export const Textarea = ({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className={cx(underline.replace('h-12', 'min-h-28 py-3'), className)} {...props} />
);

export const Card = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => <div className={cx('rounded-sm border border-line bg-surface p-6 shadow-e1', className)} {...props} />;

export const Eyebrow = ({ children, className }: { children: ReactNode; className?: string }) => <p className={cx('eyebrow', className)}>{children}</p>;

export const PageHeading = ({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) => (
  <div className="rise mb-10 flex flex-wrap items-end justify-between gap-6 border-b border-line-strong pb-8">
    <div>
      {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
      <h1 className="display text-5xl md:text-7xl">{title}</h1>
    </div>
    {action}
  </div>
);

const statusStyles: Record<ItemStatus, string> = {
  active: 'bg-live/12 text-live',
  draft: 'bg-white/8 text-text-2',
  pending: 'bg-outbid/12 text-outbid',
  sold: 'bg-info/12 text-info',
  expired: 'bg-white/8 text-ended',
  rejected: 'bg-danger/12 text-danger',
};

export const StatusBadge = ({ status, label }: { status: ItemStatus; label?: string }) => (
  <span className={cx('inline-flex h-7 items-center gap-2 rounded-full px-3 text-[11px] font-semibold tracking-[0.16em] uppercase', statusStyles[status])}>
    {status === 'active' && <span className="live-dot size-1.5 rounded-full bg-current" />}
    {label ?? (status === 'active' ? 'Live' : status)}
  </span>
);

export const Spinner = () => <div className="mx-auto my-16 size-8 animate-spin rounded-full border border-line-strong border-t-gold-300" role="progressbar" aria-label="Loading" />;

export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden className={cx('skeleton', className)} />;

export const EmptyState = ({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) => (
  <div className="rounded-sm border border-dashed border-line-strong px-6 py-20 text-center">
    <p className="display text-4xl">{title}</p>
    {hint && <p className="mx-auto mt-3 max-w-md text-sm text-muted">{hint}</p>}
    {action && <div className="mt-8">{action}</div>}
  </div>
);

export const ErrorState = ({ message }: { message: string }) => <p role="alert" className="rounded-sm border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{message}</p>;

export const Pagination = ({ meta, onChange }: { meta: PageMeta; onChange: (page: number) => void }) =>
  meta.totalPages > 1 ? (
    <div className="mt-12 flex items-center justify-center gap-4">
      <Button variant="secondary" size="sm" disabled={meta.page <= 1} onClick={() => onChange(meta.page - 1)}>
        Previous
      </Button>
      <span className="text-sm text-muted tnum">
        Page {meta.page} of {meta.totalPages}
      </span>
      <Button variant="secondary" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => onChange(meta.page + 1)}>
        Next
      </Button>
    </div>
  ) : null;

export const StatCard = ({ label, value, hint }: { label: string; value: string | number; hint?: string }) => (
  <div className="border-t border-line-strong pt-4">
    <Eyebrow className="text-muted!">{label}</Eyebrow>
    <p className="display tnum mt-2 text-5xl">{value}</p>
    {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
  </div>
);

export const Tabs = <T extends string>({ tabs, value, onChange }: { tabs: { key: T; label: string; count?: number }[]; value: T; onChange: (key: T) => void }) => (
  <div role="tablist" className="mb-8 flex gap-1 overflow-x-auto border-b border-line">
    {tabs.map(tab => (
      <button
        key={tab.key}
        role="tab"
        aria-selected={tab.key === value}
        onClick={() => onChange(tab.key)}
        className={cx('-mb-px border-b px-4 py-3 text-[11px] font-semibold tracking-[0.18em] whitespace-nowrap uppercase transition', tab.key === value ? 'border-gold-300 text-gold-300' : 'border-transparent text-muted hover:text-text')}
      >
        {tab.label}
        {tab.count !== undefined && <span className="ml-2 text-muted tnum">{tab.count}</span>}
      </button>
    ))}
  </div>
);

export const Segmented = <T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T; onChange: (key: T) => void }) => (
  <div className="inline-flex rounded-full border border-line-strong p-1">
    {options.map(option => (
      <button key={option.key} onClick={() => onChange(option.key)} aria-pressed={option.key === value} className={cx('h-8 rounded-full px-4 text-xs font-semibold capitalize transition', option.key === value ? 'bg-gold-300 text-ink' : 'text-text-2 hover:text-gold-300')}>
        {option.label}
      </button>
    ))}
  </div>
);
