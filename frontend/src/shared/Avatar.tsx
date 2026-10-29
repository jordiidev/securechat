const HUE_STEP = 47;

function hueOf(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return (hash * HUE_STEP) % 360;
}

interface AvatarProps {
  name: string;
  size?: 'small' | 'medium';
}

export function Avatar({ name, size = 'medium' }: AvatarProps) {
  return (
    <span
      className={`avatar avatar--${size}`}
      style={{ backgroundColor: `hsl(${hueOf(name)} 48% 46%)` }}
      aria-hidden="true"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
