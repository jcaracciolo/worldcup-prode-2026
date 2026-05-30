interface UserNameProps {
  name: string;
  country?: string | null;
  className?: string;
}

/**
 * Renders a user's display name with an optional country flag.
 * Centralizes flag+name rendering so it's consistent everywhere.
 */
export default function UserName({ name, country, className }: UserNameProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      {country && (
        <img
          src={`https://flagcdn.com/w20/${country}.png`}
          alt={country.toUpperCase()}
          className="w-4 h-3 object-contain shrink-0"
        />
      )}
      <span className="truncate">{name}</span>
    </span>
  );
}
