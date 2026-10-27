import type { ComponentChildren, JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { back, type Route } from '../router';
import { uiSound } from '../state/settings';
import { Store, useStore } from '../state/store';
import { Icon, type IconName } from './Icon';

export function TopBar({ title, backTo, right }: { title?: string; backTo?: Route; right?: ComponentChildren }) {
  return (
    <header class="topbar">
      <button
        class="icon-btn"
        aria-label="Back"
        onClick={() => {
          uiSound('back');
          back(backTo);
        }}
      >
        <Icon name="back" />
      </button>
      <h1 class="topbar-title">{title}</h1>
      <div class="topbar-right">{right}</div>
    </header>
  );
}

type ButtonProps = {
  children?: ComponentChildren;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'lg' | 'md' | 'sm';
  onClick?: (e: MouseEvent) => void;
  disabled?: boolean;
  class?: string;
  label?: string;
  silent?: boolean;
  type?: 'button' | 'submit';
};

export function Button({ children, icon, variant = 'secondary', size = 'md', onClick, disabled, class: cls, label, silent, type = 'button' }: ButtonProps) {
  return (
    <button
      type={type}
      class={`btn btn-${variant} btn-${size} ${cls ?? ''}`}
      disabled={disabled}
      aria-label={label}
      onClick={(e) => {
        if (!silent) uiSound();
        onClick?.(e as MouseEvent);
      }}
    >
      {icon && <Icon name={icon} size={size === 'lg' ? 24 : 20} />}
      {children && <span>{children}</span>}
    </button>
  );
}

export function IconButton({ icon, label, onClick, active, class: cls }: { icon: IconName; label: string; onClick: () => void; active?: boolean; class?: string }) {
  return (
    <button
      class={`icon-btn ${active ? 'active' : ''} ${cls ?? ''}`}
      aria-label={label}
      title={label}
      onClick={() => {
        uiSound();
        onClick();
      }}
    >
      <Icon name={icon} />
    </button>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label class="row toggle-row">
      <span class="row-text">
        <span class="row-label">{label}</span>
        {hint && <span class="row-hint">{hint}</span>}
      </span>
      <input
        type="checkbox"
        class="switch"
        role="switch"
        checked={checked}
        onChange={(e) => {
          uiSound();
          onChange((e.target as HTMLInputElement).checked);
        }}
      />
    </label>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  hint?: string;
}) {
  return (
    <div class="row slider-row">
      <span class="row-text">
        <span class="row-label">
          {label} <b class="row-value">{format ? format(value) : value}</b>
        </span>
        {hint && <span class="row-hint">{hint}</span>}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))}
      />
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div class="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          role="radio"
          aria-checked={o.value === value}
          class={o.value === value ? 'on' : ''}
          onClick={() => {
            uiSound();
            onChange(o.value);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ label, value, onChange, unit = 'ms', hint, min = -300, max = 500 }: { label: string; value: number; onChange: (v: number) => void; unit?: string; hint?: string; min?: number; max?: number }) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div class="row stepper-row">
      <span class="row-text">
        <span class="row-label">{label}</span>
        {hint && <span class="row-hint">{hint}</span>}
      </span>
      <div class="stepper">
        <button aria-label={`${label} -10`} onClick={() => set(value - 10)}>
          −10
        </button>
        <button aria-label={`${label} -1`} onClick={() => set(value - 1)}>
          −1
        </button>
        <output>
          {value > 0 ? '+' : ''}
          {value}
          <small>{unit}</small>
        </output>
        <button aria-label={`${label} +1`} onClick={() => set(value + 1)}>
          +1
        </button>
        <button aria-label={`${label} +10`} onClick={() => set(value + 10)}>
          +10
        </button>
      </div>
    </div>
  );
}

export function Stars({ count, max = 5, size = 14 }: { count: number; max?: number; size?: number }) {
  return (
    <span class="stars" aria-label={`${count} of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <span class={i < count ? 'star on' : 'star'}>
          <Icon name="star" size={size} />
        </span>
      ))}
    </span>
  );
}

export function LevelMeter({ level }: { level: number }) {
  return (
    <span class="level" aria-label={`Level ${level} of 10`}>
      {Array.from({ length: 10 }, (_, i) => (
        <i class={i < level ? `on l${Math.min(4, Math.floor(i / 2.5))}` : ''} />
      ))}
    </span>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ComponentChildren }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div class="sheet-grip" />
        {title && <h2 class="sheet-title">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function MenuItem({ icon, label, hint, onClick, danger }: { icon: IconName; label: string; hint?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      class={`menu-item ${danger ? 'danger' : ''}`}
      onClick={() => {
        uiSound();
        onClick();
      }}
    >
      <Icon name={icon} />
      <span class="menu-text">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </span>
    </button>
  );
}

export function Card({ children, class: cls, onClick }: { children: ComponentChildren; class?: string; onClick?: JSX.MouseEventHandler<HTMLDivElement> }) {
  return (
    <div class={`card ${cls ?? ''}`} onClick={onClick}>
      {children}
    </div>
  );
}

// --- confirm dialog -----------------------------------------------------------

interface ConfirmRequest {
  title: string;
  body?: string;
  confirm: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}
const confirmStore = new Store<ConfirmRequest | null>(null);

export function confirmDialog(opts: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => confirmStore.set({ ...opts, resolve }));
}

export function ConfirmHost() {
  const req = useStore(confirmStore);
  if (!req) return null;
  const done = (ok: boolean) => {
    confirmStore.set(null);
    req.resolve(ok);
  };
  return (
    <Sheet open onClose={() => done(false)} title={req.title}>
      {req.body && <p class="sheet-body">{req.body}</p>}
      <div class="sheet-actions">
        <Button variant="ghost" onClick={() => done(false)}>
          Cancel
        </Button>
        <Button variant={req.danger ? 'danger' : 'primary'} onClick={() => done(true)}>
          {req.confirm}
        </Button>
      </div>
    </Sheet>
  );
}
