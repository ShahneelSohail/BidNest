import Link from 'next/link';
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import type { PageMeta } from '../lib/api';
import type { ItemStatus } from '../lib/types';

export const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ');

const buttonStyles = {
  primary: 'bg-white text-black hover:bg-yellow',
  secondary: 'border border-line bg-surface-2 text-white hover:border-white/40',
  danger: 'bg-red-500/90 text-white hover:bg-red-500',
  ghost: 'text-muted hover:text-white',
} as const;

type Variant = keyof typeof buttonStyles;
const buttonBase = 'inline-flex whitespace-nowrap items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50';

export const Button = ({ variant = 'primary', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) => (
  <button className={cx(buttonBase, buttonStyles[variant], className)} {...props} />
);

export const LinkButton = ({ href, variant = 'primary', className, children }: { href: string; variant?: Variant; className?: string; children: ReactNode }) => (
  <Link href={href} className={cx(buttonBase, buttonStyles[variant], className)}>
    {children}
  </Link>
);

const fieldStyles = 'w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-white placeholder:text-muted focus:border-yellow focus:outline-none';

export const Field = ({ label, error, children }: { label: string; error?: string; children: ReactNode }) => (
  <label className="block space-y-1.5">
    <span className="text-sm text-muted">{label}</span>
    {children}
    {error && <span className="block text-xs text-red-400">{error}</span>}
  </label>
);

export const Input = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => <input className={cx(fieldStyles, className)} {...props} />;
export const Textarea = ({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className={cx(fieldStyles, 'min-h-28', className)} {...props} />;
export const Select = ({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) => <select className={cx(fieldStyles, className)} {...props} />;

export const Card = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => <div className={cx('rounded-2xl border border-line bg-surface p-5', className)} {...props} />;

export const PageHeading = ({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) => (
  <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
    <div>
      {eyebrow && <p className="mb-1 text-sm text-yellow">{eyebrow}</p>}
      <h1 className="text-3xl font-semibold md:text-4xl">{title}</h1>
    </div>
    {action}
  </div>
);

const statusStyles: Record<ItemStatus, string> = {
  active: 'bg-emerald-500/15 text-emerald-300',
  pending: 'bg-amber-500/15 text-amber-300',
  sold: 'bg-sky-500/15 text-sky-300',
  expired: 'bg-white/10 text-muted',
  rejected: 'bg-red-500/15 text-red-300',
};

export const StatusBadge = ({ status }: { status: ItemStatus }) => (
  <span className={cx('rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', statusStyles[status])}>{status}</span>
);

export const Spinner = () => <div className="mx-auto my-12 size-8 animate-spin rounded-full border-2 border-line border-t-yellow" role="progressbar" aria-label="Loading" />;

export const EmptyState = ({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) => (
  <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
    <p className="text-lg">{title}</p>
    {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const ErrorState = ({ message }: { message: string }) => <p className="rounded-xl border border-red-400/30 bg-red-950/50 px-4 py-3 text-sm text-red-200">{message}</p>;

export const Pagination = ({ meta, onChange }: { meta: PageMeta; onChange: (page: number) => void }) =>
  meta.totalPages > 1 ? (
    <div className="mt-8 flex items-center justify-center gap-3">
      <Button variant="secondary" disabled={meta.page <= 1} onClick={() => onChange(meta.page - 1)}>
        Previous
      </Button>
      <span className="text-sm text-muted">
        Page {meta.page} of {meta.totalPages}
      </span>
      <Button variant="secondary" disabled={meta.page >= meta.totalPages} onClick={() => onChange(meta.page + 1)}>
        Next
      </Button>
    </div>
  ) : null;

export const StatCard = ({ label, value }: { label: string; value: string | number }) => (
  <Card>
    <p className="text-sm text-muted">{label}</p>
    <p className="mt-1 text-3xl font-semibold">{value}</p>
  </Card>
);
