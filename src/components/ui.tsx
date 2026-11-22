import type { ReactNode } from "react";

export function Card({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "pine" | "amber" | "stamp" }) {
  const tones = {
    plain: "bg-card border-rule",
    pine: "bg-pine-wash border-pine/30",
    amber: "bg-amber-wash border-amber/40",
    stamp: "bg-stamp-wash border-stamp/40",
  };
  return <section className={`rounded-xl border p-5 sm:p-6 ${tones[tone]}`}>{children}</section>;
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "quiet";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const variants = {
    primary: "bg-pine text-white hover:bg-pine-dark border-pine",
    secondary: "bg-card text-pine-dark border-pine hover:bg-pine-wash",
    quiet: "bg-transparent text-pine-dark border-transparent underline underline-offset-4 hover:text-ink",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-12 items-center justify-center rounded-lg border-2 px-5 py-2.5 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block font-semibold">{label}</span>
      {hint && <span className="mb-1 block text-sm text-muted">{hint}</span>}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="font-serif text-2xl font-bold leading-tight sm:text-3xl">{children}</h2>;
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="font-serif text-xl font-bold leading-snug">{children}</h3>;
}
