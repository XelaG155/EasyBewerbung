interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`card-surface rounded-xl p-6 backdrop-blur ${className}`}>
      {children}
    </div>
  );
}
