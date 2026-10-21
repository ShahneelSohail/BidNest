'use client';

import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { MAX_PHOTOS, MAX_PHOTO_BYTES, MIN_PHOTOS, PHOTO_TYPES } from '../lib/seller';
import { Icon } from './sell-icons';
import { cx, Eyebrow } from './ui';

export interface Photo {
  key: string;
  src: string;
  file?: File;
  existingId?: number;
}

interface Option<T> {
  key: T;
  label: string;
  badge?: string;
}

export const FieldLabel = ({ children }: { children: ReactNode }) => <Eyebrow className="text-muted!">{children}</Eyebrow>;

export const FieldError = ({ message }: { message?: string }) => (message ? <p role="alert" className="text-[13px] text-danger">{message}</p> : null);

export const PillRadio = <T extends string | number>({ options, value, onChange, invalid }: { options: Option<T>[]; value: T | ''; onChange: (key: T) => void; invalid?: boolean }) => (
  <div role="radiogroup" className={cx('flex max-w-full self-start overflow-x-auto rounded-full border bg-surface p-1', invalid ? 'border-danger' : 'border-line')}>
    {options.map(option => (
      <button
        key={option.key}
        type="button"
        role="radio"
        aria-checked={option.key === value}
        onClick={() => onChange(option.key)}
        className={cx('tnum h-9 shrink-0 rounded-full px-4 text-[13px] font-medium whitespace-nowrap transition', option.key === value ? 'bg-text text-ink' : 'text-text-2 hover:text-text')}
      >
        {option.label}
      </button>
    ))}
  </div>
);

export const ChoiceChips = <T extends string | number>({ options, value, onChange }: { options: Option<T>[]; value: T | null; onChange: (key: T) => void }) => (
  <div className="flex flex-wrap gap-2">
    {options.map(option => (
      <button
        key={option.key}
        type="button"
        aria-pressed={option.key === value}
        onClick={() => onChange(option.key)}
        className={cx('relative h-11 rounded-full border px-4 text-[13px] font-medium transition hover:border-gold-300', option.key === value ? 'border-gold-300 bg-gold-300/12 text-gold-300' : 'border-line-strong text-text')}
      >
        {option.label}
        {option.badge && <span className="absolute -top-2.5 right-2.5 border border-gold-300/40 bg-ink px-1.5 py-0.5 text-[9px] font-bold tracking-[0.14em] text-gold-300 uppercase">{option.badge}</span>}
      </button>
    ))}
  </div>
);

const problemWith = (file: File, taken: number): string | undefined => {
  if (taken >= MAX_PHOTOS) return `limit of ${MAX_PHOTOS} photos`;
  if (!PHOTO_TYPES.includes(file.type)) return 'not a JPG, PNG, GIF or WebP';
  return file.size > MAX_PHOTO_BYTES ? 'over 5 MB' : undefined;
};

const tileButton = 'grid size-7 place-items-center text-text';

export const PhotoPicker = ({ photos, onChange, error }: { photos: Photo[]; onChange: (photos: Photo[]) => void; error?: string }) => {
  const input = useRef<HTMLInputElement>(null);
  const counter = useRef(0);
  const [dropping, setDropping] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [rejected, setRejected] = useState<{ key: number; message: string }[]>([]);

  const addFiles = (files: Iterable<File>) => {
    const accepted: Photo[] = [];
    const refused: typeof rejected = [];
    for (const file of files) {
      const problem = problemWith(file, photos.length + accepted.length);
      if (problem) refused.push({ key: counter.current++, message: `${file.name.slice(0, 18)} · ${problem}` });
      else accepted.push({ key: `new-${counter.current++}`, src: URL.createObjectURL(file), file });
    }
    onChange([...photos, ...accepted]);
    setRejected(current => [...current, ...refused]);
    setDropping(false);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= photos.length) return;
    const next = [...photos];
    next.splice(to, 0, next.splice(from, 1)[0]!);
    onChange(next);
  };

  const endDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  const dropOnZone = (event: DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
    else setDropping(false);
  };

  const dropOnTile = (event: DragEvent, index: number) => {
    if (dragIndex === null) return;
    event.preventDefault();
    event.stopPropagation();
    move(dragIndex, index);
    endDrag();
  };

  const zoneClass = cx('border border-dashed transition', dropping ? 'border-gold-300 bg-gold-300/5 shadow-[inset_0_0_60px_-20px_rgba(231,211,147,0.4)]' : error ? 'border-danger' : 'border-line-strong');
  const zoneTitle = dropping ? 'Release to add photos' : 'Drop photos here';

  return (
    <div
      onDragOver={event => {
        event.preventDefault();
        if (dragIndex === null) setDropping(true);
      }}
      onDragLeave={event => !event.currentTarget.contains(event.relatedTarget as Node | null) && setDropping(false)}
      onDrop={dropOnZone}
      className="flex flex-col gap-4"
    >
      <input
        ref={input}
        type="file"
        multiple
        accept={PHOTO_TYPES.join(',')}
        className="hidden"
        onChange={event => {
          addFiles(event.target.files ?? []);
          event.target.value = '';
        }}
      />
      {photos.length === 0 ? (
        <button type="button" onClick={() => input.current?.click()} className={cx(zoneClass, 'flex min-h-[300px] flex-col items-center justify-center gap-4 px-4 text-text hover:border-gold-300 hover:bg-gold-300/[0.03]')}>
          <span className="grid size-14 place-items-center rounded-full border border-line-strong text-gold-300">
            <Icon name="upload" size={22} />
          </span>
          <span className="display text-3xl">{zoneTitle}</span>
          <span className="text-sm text-muted">
            or <span className="border-b border-gold-300/40 text-gold-300">browse files</span> · JPG, PNG, GIF or WebP up to 5 MB · at least {MIN_PHOTOS}
          </span>
        </button>
      ) : (
        <div className={cx(zoneClass, 'p-4')}>
          <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
            {photos.map((photo, index) => (
              <div
                key={photo.key}
                draggable
                onDragStart={event => {
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', String(index));
                  setDragIndex(index);
                }}
                onDragOver={event => {
                  if (dragIndex === null) return;
                  event.preventDefault();
                  event.stopPropagation();
                  setOverIndex(index);
                }}
                onDrop={event => dropOnTile(event, index)}
                onDragEnd={endDrag}
                onClick={() => move(index, 0)}
                title="Click to set as cover, drag to reorder"
                className={cx('relative aspect-[4/5] cursor-grab overflow-hidden bg-surface-2 transition', index === 0 && 'outline-2 -outline-offset-2 outline-gold-300', dragIndex === index && 'opacity-35', overIndex === index && dragIndex !== index && 'shadow-[0_0_0_2px_var(--color-gold-300)]')}
              >
                <img src={photo.src} alt={`Photo ${index + 1}`} draggable={false} className="pointer-events-none size-full object-cover" />
                <span className="tnum absolute top-2 right-2 bg-ink/70 px-1.5 py-0.5 text-[11px]">{index + 1}</span>
                {index === 0 && <span className="absolute top-2 left-2 bg-gold-300 px-[7px] py-1 text-[9.5px] font-bold tracking-[0.16em] text-ink uppercase">Cover</span>}
                <div className="absolute inset-x-0 bottom-0 flex h-9 items-center justify-between bg-gradient-to-t from-ink/90 to-transparent px-1">
                  <span className="flex">
                    {([['Move left', 'left', -1], ['Move right', 'right', 1]] as const).map(([label, icon, step]) => (
                      <button
                        key={icon}
                        type="button"
                        aria-label={label}
                        className={tileButton}
                        onClick={event => {
                          event.stopPropagation();
                          move(index, index + step);
                        }}
                      >
                        <Icon name={icon} size={14} strokeWidth={1.75} />
                      </button>
                    ))}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove photo"
                    className={cx(tileButton, 'rounded-full bg-ink/60 transition hover:bg-danger hover:text-ink')}
                    onClick={event => {
                      event.stopPropagation();
                      onChange(photos.filter((_, position) => position !== index));
                    }}
                  >
                    <Icon name="x" size={12} strokeWidth={2} />
                  </button>
                </div>
              </div>
            ))}
            {rejected.map(entry => (
              <div key={entry.key} className="flex aspect-[4/5] flex-col items-center justify-center gap-2 border border-danger/50 bg-danger/5 p-2.5 text-center">
                <Icon name="alert" size={18} className="text-danger" />
                <span className="text-[11.5px] leading-snug text-danger">{entry.message}</span>
                <button type="button" className="text-xs font-medium text-text-2" onClick={() => setRejected(current => current.filter(other => other.key !== entry.key))}>
                  Dismiss
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button type="button" onClick={() => input.current?.click()} className="flex aspect-[4/5] flex-col items-center justify-center gap-2 border border-dashed border-line-strong text-[13px] font-medium text-gold-300 transition hover:border-gold-300 hover:bg-gold-300/5">
                <Icon name="plus" size={20} />
                {zoneTitle}
              </button>
            )}
          </div>
        </div>
      )}
      <div className="tnum flex justify-between gap-4 text-[13px] text-muted">
        <span>First photo is the cover. Click a tile to make it the cover; drag or use the arrows to reorder.</span>
        <span className="shrink-0">
          {photos.length} / {MAX_PHOTOS}
        </span>
      </div>
      <FieldError message={error} />
    </div>
  );
};
