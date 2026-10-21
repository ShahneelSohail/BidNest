'use client';

import { useEffect, type ReactNode } from 'react';
import { Button } from './ui';

export const ConfirmDialog = ({ eyebrow, title, children, cancelLabel = 'Cancel', confirmLabel, pending, onConfirm, onClose }: { eyebrow: string; title: string; children: ReactNode; cancelLabel?: string; confirmLabel: string; pending?: boolean; onConfirm: () => void; onClose: () => void }) => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm" />
      <div role="dialog" aria-modal="true" aria-label={title} className="fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-md border border-line bg-surface-2 p-8 shadow-e3">
        <p className="eyebrow text-danger!">{eyebrow}</p>
        <h3 className="display text-[34px] leading-[1.08]">{title}</h3>
        <div className="text-sm leading-relaxed text-text-2">{children}</div>
        <div className="flex justify-end gap-2 pt-1.5">
          <Button variant="ghost" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant="danger" disabled={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </>
  );
};
