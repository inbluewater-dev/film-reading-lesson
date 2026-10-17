// 공통 UI 조각 (Tailwind)
import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';

export function Button({ variant = 'primary', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const base = 'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const styles = {
    primary: 'bg-stone-900 text-white hover:bg-stone-700',
    secondary: 'border border-stone-300 bg-white text-stone-800 hover:bg-stone-100',
    danger: 'border border-red-300 bg-white text-red-700 hover:bg-red-50',
    ghost: 'text-stone-700 hover:bg-stone-100',
  }[variant];
  return <button className={`${base} ${styles} ${className}`} {...rest} />;
}

export function Field({ label, hint, id, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const auto = useId();
  const inputId = id ?? auto;
  const hintId = hint ? `${inputId}-hint` : undefined;
  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={inputId}
        aria-describedby={hintId}
        className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-600"
        {...rest}
      />
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-stone-500">
          {hint}
        </p>
      )}
    </div>
  );
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'info' | 'success'; children: ReactNode }) {
  const styles = { error: 'text-red-700', info: 'text-stone-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2', success: 'text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2' }[tone];
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`text-sm ${styles}`}>
      {children}
    </p>
  );
}

export function Badge({ tone, children }: { tone: 'amber' | 'green' | 'red' | 'stone'; children: ReactNode }) {
  const styles = { amber: 'bg-amber-100 text-amber-900', green: 'bg-emerald-100 text-emerald-900', red: 'bg-red-100 text-red-900', stone: 'bg-stone-200 text-stone-700' }[tone];
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${styles}`}>{children}</span>;
}

/** 오류 객체에서 화면용 메시지를 꺼낸다 */
export function errorMessage(e: unknown): string {
  return e instanceof Error && e.message ? e.message : '알 수 없는 오류가 발생했습니다.';
}
