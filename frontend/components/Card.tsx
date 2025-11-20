interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-slate-700 bg-slate-800/50 p-6 backdrop-blur ${className}`}
    >
      {children}
    </div>
  );
}
