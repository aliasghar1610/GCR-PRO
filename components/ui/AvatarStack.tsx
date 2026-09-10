import { Avatar } from "./Avatar";

export function AvatarStack({
  people,
  size = 24,
  max = 4,
}: {
  people: { name: string; image?: string | null }[];
  size?: number;
  max?: number;
}) {
  if (people.length === 0) return null;
  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;

  return (
    <div className="flex items-center -space-x-2">
      {shown.map((p, i) => (
        <Avatar
          key={i}
          name={p.name}
          image={p.image}
          size={size}
          className="ring-2 ring-bg-card"
        />
      ))}
      {overflow > 0 && (
        <span
          className="flex items-center justify-center rounded-full bg-bg-subtle text-text-muted text-[11px] font-medium ring-2 ring-bg-card"
          style={{ width: size, height: size }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
