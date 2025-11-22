interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Card({ children, className = "", style }: CardProps) {
  return (
    <div className={`card-surface rounded-xl p-6 backdrop-blur ${className}`} style={style}>
      {children}
    </div>
  );
}
