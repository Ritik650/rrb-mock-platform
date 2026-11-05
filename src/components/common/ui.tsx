import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'outline' | 'danger' | 'submit' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-action text-white border-action-deep hover:bg-action-deep',
  outline: 'bg-white text-ink-2 border-ink-3 hover:bg-panel',
  danger: 'bg-white text-nans border-nans hover:bg-[#fce8e6]',
  submit: 'bg-ans text-white border-ans-deep hover:bg-ans-deep',
  ghost: 'bg-transparent text-white border-white/50 hover:bg-white/10',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'outline', className = '', type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex h-8 items-center justify-center gap-1 border px-3 text-xs font-semibold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}

/** Small key hint printed on exam buttons. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="ml-1 border border-current/40 px-1 font-mono text-[10px] font-medium opacity-80">
      {children}
    </kbd>
  );
}

export function LevelBadge({ level }: { level: string }) {
  const hard = level === 'Hard';
  return (
    <span
      className={`border px-1.5 py-0.5 text-[10px] font-bold ${hard ? 'border-mark text-mark' : 'border-action text-action'}`}
    >
      {level}
    </span>
  );
}

interface ModalProps {
  title: string;
  children: ReactNode;
  footer: ReactNode;
  onClose?: () => void;
  wide?: boolean;
}

/** Flat dialog over a 50% blackout, per the design system. Escape closes it when closable. */
export function Modal({ title, children, footer, onClose, wide }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.focus();
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`flex max-h-full w-full flex-col border-2 border-navy bg-white ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
      >
        <h2 className="bg-navy px-4 py-2 text-[15px] font-semibold text-white">{title}</h2>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">{children}</div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-2">{footer}</div>
      </div>
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <p className="p-6 text-ink-3">{label}</p>;
}

export function ErrorNote({ error }: { error: Error }) {
  return (
    <div role="alert" className="m-4 border border-nans bg-[#fce8e6] p-3 text-sm text-ink">
      <p className="font-semibold">Something went wrong</p>
      <p>{error.message}</p>
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 text-[15px] font-semibold text-navy">{children}</h2>;
}
