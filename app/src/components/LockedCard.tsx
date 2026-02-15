interface LockedCardProps {
  message: string;
}

/**
 * Standardized locked/hidden content card.
 * Used whenever content is not yet available (stage locked, predictions hidden, etc.)
 */
export default function LockedCard({ message }: LockedCardProps) {
  return (
    <div className="glass-card p-8 text-center">
      <div className="text-5xl mb-4">🔒</div>
      <p className="text-white/60 text-lg">{message}</p>
    </div>
  );
}
