'use client';

import { plural } from '../lib/format';
import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import type { AdminCategory } from '../lib/admin';
import { Async, AdminTitle, ConfirmButton, Icon, Pill, useAdminMutation } from './admin';
import { Button, cx, Eyebrow, Field, Input, Select } from './ui';

interface MergeVariables {
  keepId: number;
  sourceIds: number[];
}

const toggleIn = (set: Set<number>, id: number) => {
  const next = new Set(set);
  if (!next.delete(id)) next.add(id);
  return next;
};

const NameEditor = ({ initial, className, onSave, onCancel }: { initial: string; className: string; onSave: (name: string) => void; onCancel: () => void }) => {
  const [name, setName] = useState(initial);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim() && name.trim() !== initial) onSave(name.trim());
    else onCancel();
  };
  return (
    <form onSubmit={submit} className="min-w-0 flex-1">
      <input autoFocus aria-label="Category name" value={name} onChange={event => setName(event.target.value)} onKeyDown={event => event.key === 'Escape' && onCancel()} onBlur={onCancel} className={cx('h-10 w-full rounded-sm border border-gold-300 bg-surface px-2.5 text-text outline-none', className)} />
    </form>
  );
};

interface RowProps {
  category: AdminCategory;
  lots: number;
  depth: 0 | 1;
  collapsed?: boolean;
  selected: boolean;
  onToggleCollapse?: () => void;
  onToggleSelect: () => void;
  onAddChild?: () => void;
  onMove: (delta: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

const CategoryRow = ({ category, lots, depth, collapsed, selected, onToggleCollapse, onToggleSelect, onAddChild, onMove, canMoveUp, canMoveDown }: RowProps) => {
  const [editing, setEditing] = useState(false);
  const rename = useAdminMutation((name: string) => api.patch(`/admin/categories/${category.id}`, { name, parentId: category.parentId, isActive: category.isActive }), 'Category renamed.');
  const toggle = useAdminMutation(() => api.patch(`/admin/categories/${category.id}/toggle`), category.isActive ? 'Category hidden from buyers.' : 'Category visible to buyers.');
  const remove = useAdminMutation(() => api.delete(`/admin/categories/${category.id}`), 'Category deleted.');
  const nameClass = depth === 0 ? 'display text-2xl' : 'text-[15px]';

  return (
    <div className={cx('flex flex-wrap items-center gap-x-2.5 px-2 py-1 transition hover:bg-gold-300/[0.03]', depth === 0 ? 'min-h-[60px]' : 'ml-[38px] min-h-12 border-l border-line pl-3')}>
      {depth === 0 && (
        <button onClick={onToggleCollapse} aria-label={collapsed ? 'Expand' : 'Collapse'} disabled={category.childCount === 0} className="grid size-7 place-items-center text-text-2 disabled:opacity-0">
          <span className={cx('transition-transform duration-300 ease-(--ease-expo)', !collapsed && 'rotate-90')}>
            <Icon name="next" size={14} />
          </span>
        </button>
      )}
      <button role="checkbox" aria-checked={selected} aria-label={`Select ${category.name}`} onClick={onToggleSelect} className={cx('grid size-[18px] shrink-0 place-items-center rounded-[2px] border text-[11px] leading-none text-ink', selected ? 'border-gold-300 bg-gold-300' : 'border-line-strong')}>
        {selected && <Icon name="check" size={12} />}
      </button>
      {editing ? (
        <NameEditor
          initial={category.name}
          className={nameClass}
          onSave={name => {
            setEditing(false);
            rename.mutate(name);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <span className={cx('flex min-w-0 flex-1 items-center gap-3', nameClass, !category.isActive && 'text-muted')}>
          <span className="truncate">{category.name}</span>
          {!category.isActive && <Pill tone="neutral">Hidden</Pill>}
        </span>
      )}
      <span className="tnum shrink-0 text-[13px] text-muted">{plural(lots, 'lot')}</span>
      <span className="ml-auto flex shrink-0 flex-wrap items-center gap-1">
        <Button size="sm" variant="ghost" disabled={!canMoveUp} onClick={() => onMove(-1)} aria-label={`Move ${category.name} up`}>
          <Icon name="up" size={14} />
        </Button>
        <Button size="sm" variant="ghost" disabled={!canMoveDown} onClick={() => onMove(1)} aria-label={`Move ${category.name} down`}>
          <Icon name="down" size={14} />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label={`Rename ${category.name}`}>
          <Icon name="pencil" size={14} />
        </Button>
        {onAddChild && (
          <Button size="sm" variant="ghost" onClick={onAddChild} aria-label={`Add subcategory to ${category.name}`}>
            <Icon name="plus" size={15} />
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={toggle.isPending} onClick={() => toggle.mutate()}>
          {category.isActive ? 'Hide' : 'Show'}
        </Button>
        <ConfirmButton label="Delete" prompt="Delete category?" confirmLabel="Delete" disabled={remove.isPending || category.itemCount > 0 || category.childCount > 0} onConfirm={() => remove.mutate()} />
      </span>
    </div>
  );
};

const CreateForm = ({ parents, parentId, onParentChange, onDone }: { parents: AdminCategory[]; parentId: number | null; onParentChange: (id: number | null) => void; onDone: () => void }) => {
  const [name, setName] = useState('');
  const create = useAdminMutation(() => api.post('/admin/categories', { name, parentId, isActive: true }), 'Category created.');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(undefined, { onSuccess: onDone });
  };
  return (
    <form onSubmit={submit} className="rise flex flex-wrap items-end gap-4 border border-line bg-surface px-6 py-5">
      <div className="min-w-48 flex-1">
        <Field label="Name">
          <Input autoFocus value={name} onChange={event => setName(event.target.value)} required maxLength={150} placeholder="e.g. Vintage cameras" />
        </Field>
      </div>
      <div className="min-w-48">
        <Field label="Parent">
          <Select value={parentId ?? ''} onChange={event => onParentChange(event.target.value ? Number(event.target.value) : null)}>
            <option value="">Top level</option>
            {parents.map(parent => (
              <option key={parent.id} value={parent.id}>
                {parent.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Button type="submit" disabled={create.isPending}>
        Create
      </Button>
      <Button type="button" variant="ghost" onClick={onDone}>
        Cancel
      </Button>
    </form>
  );
};

const MergePanel = ({ chosen, onClear }: { chosen: AdminCategory[]; onClear: () => void }) => {
  const [keepId, setKeepId] = useState<number | null>(null);
  const merge = useAdminMutation(async ({ keepId: targetId, sourceIds }: MergeVariables) => {
    for (const sourceId of sourceIds) await api.post('/admin/categories/merge', { sourceId, targetId, deleteSource: true });
  }, 'Categories merged.');

  if (chosen.length < 2)
    return (
      <div className="flex flex-col gap-3 border border-line bg-surface p-6">
        <p className="display text-2xl">Merge duplicates</p>
        <p className="text-sm leading-relaxed text-text-2">Tick two or more categories in the same group to merge them. Lots move to the one you keep and the others are removed.</p>
      </div>
    );

  if (new Set(chosen.map(category => category.parentId)).size > 1)
    return (
      <p className="border border-outbid/25 bg-outbid/5 p-4 text-[13px] leading-normal">
        Selected categories are in different groups. Merge works within one group.{' '}
        <button onClick={onClear} className="text-gold-300">
          Clear selection
        </button>
      </p>
    );

  const keep = chosen.find(category => category.id === keepId) ?? chosen[0];
  const sources = chosen.filter(category => category.id !== keep.id);
  const movedLots = sources.reduce((sum, category) => sum + category.itemCount, 0);

  return (
    <div className="rise flex flex-col gap-4 border border-gold-300/40 bg-surface-2 p-6 shadow-e2">
      <div>
        <Eyebrow className="mb-1.5">Merge {chosen.length} categories</Eyebrow>
        <p className="display text-2xl">Which one stays?</p>
      </div>
      <div role="radiogroup" className="flex flex-col border-t border-line">
        {chosen.map(category => (
          <button key={category.id} role="radio" aria-checked={category.id === keep.id} onClick={() => setKeepId(category.id)} className="grid min-h-12 grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line text-left">
            <span className="grid size-5 place-items-center rounded-full border border-line-strong">
              <span className={cx('size-2.5 rounded-full bg-gold-300 transition-transform', category.id === keep.id ? 'scale-100' : 'scale-0')} />
            </span>
            <span className="truncate text-sm">{category.name}</span>
            <span className="text-xs text-muted">{plural(category.itemCount, 'lot')}</span>
          </button>
        ))}
      </div>
      <p className="text-[13px] text-text-2">
        {movedLots} lot{movedLots === 1 ? '' : 's'} move to {keep.name}. {sources.length} categor{sources.length === 1 ? 'y is' : 'ies are'} removed.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClear}>
          Cancel
        </Button>
        <Button variant="gold" size="sm" disabled={merge.isPending} onClick={() => merge.mutate({ keepId: keep.id, sourceIds: sources.map(category => category.id) }, { onSuccess: onClear })}>
          Merge
        </Button>
      </div>
    </div>
  );
};

const Manager = ({ categories }: { categories: AdminCategory[] }) => {
  const [collapsed, setCollapsed] = useState(new Set<number>());
  const [selected, setSelected] = useState(new Set<number>());
  const [creating, setCreating] = useState<{ parentId: number | null } | null>(null);
  const parents = categories.filter(category => category.parentId === null);
  const kidsOf = (id: number) => categories.filter(category => category.parentId === id);
  const totalLots = categories.reduce((sum, category) => sum + category.itemCount, 0);
  const subcategories = categories.length - parents.length;
  const reorder = useAdminMutation((ids: number[]) => api.patch('/admin/categories/reorder', { ids }), 'Order saved.');
  const moverFor = (siblings: AdminCategory[], index: number) => ({
    canMoveUp: index > 0,
    canMoveDown: index < siblings.length - 1,
    onMove: (delta: -1 | 1) => {
      const ids = siblings.map(sibling => sibling.id);
      [ids[index], ids[index + delta]] = [ids[index + delta]!, ids[index]!];
      reorder.mutate(ids);
    },
  });

  return (
    <div className="grid items-start gap-12 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-6">
        <AdminTitle
          eyebrow={`Taxonomy · ${subcategories} subcategories · ${plural(totalLots, 'lot')}`}
          title="Categories"
          action={
            <Button variant="secondary" onClick={() => setCreating({ parentId: null })}>
              <Icon name="plus" size={15} />
              New category
            </Button>
          }
        />
        {creating && <CreateForm parents={parents} parentId={creating.parentId} onParentChange={parentId => setCreating({ parentId })} onDone={() => setCreating(null)} />}
        <div className="flex flex-col border-t border-line-strong">
          {parents.map((parent, parentIndex) => {
            const kids = kidsOf(parent.id);
            return (
              <div key={parent.id} className="flex flex-col border-b border-line pb-1">
                <CategoryRow
                  category={parent}
                  depth={0}
                  lots={parent.itemCount + kids.reduce((sum, kid) => sum + kid.itemCount, 0)}
                  collapsed={collapsed.has(parent.id)}
                  selected={selected.has(parent.id)}
                  onToggleCollapse={() => setCollapsed(current => toggleIn(current, parent.id))}
                  onToggleSelect={() => setSelected(current => toggleIn(current, parent.id))}
                  onAddChild={() => setCreating({ parentId: parent.id })}
                  {...moverFor(parents, parentIndex)}
                />
                {!collapsed.has(parent.id) &&
                  kids.map((kid, kidIndex) => (
                    <CategoryRow key={kid.id} category={kid} depth={1} lots={kid.itemCount} selected={selected.has(kid.id)} onToggleSelect={() => setSelected(current => toggleIn(current, kid.id))} {...moverFor(kids, kidIndex)} />
                  ))}
              </div>
            );
          })}
        </div>
      </div>
      <aside className="top-6 flex flex-col gap-4 xl:sticky">
        <MergePanel chosen={categories.filter(category => selected.has(category.id))} onClear={() => setSelected(new Set())} />
        <p className="text-xs leading-relaxed text-muted">Hidden categories disappear from buyer filters but keep their lots. A category can only be deleted once it has no lots or subcategories.</p>
      </aside>
    </div>
  );
};

export const Categories = () => {
  const categories = useQuery({ queryKey: ['admin', 'categories'], queryFn: () => api.get<AdminCategory[]>('/admin/categories?showInactive=true') });
  return <Async query={categories}>{data => <Manager categories={data} />}</Async>;
};
