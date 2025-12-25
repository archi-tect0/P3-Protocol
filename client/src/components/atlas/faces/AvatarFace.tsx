import type { FaceProps } from './types';

const DEFAULT_AVATAR = '/atlas-default-avatar.svg';

export function AvatarFace({ color, glow, assetUrl }: FaceProps) {
  const glowSize = 6 + glow * 16;

  return (
    <div
      data-testid="face-avatar"
      style={{
        position: 'relative',
        display: 'inline-block',
      }}
    >
      <img
        src={assetUrl || DEFAULT_AVATAR}
        alt="Atlas avatar"
        style={{
          width: 140,
          height: 140,
          borderRadius: 16,
          boxShadow: `0 0 ${glowSize}px ${color}aa`,
          objectFit: 'cover',
        }}
        onError={(e) => {
          (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
        }}
      />
    </div>
  );
}
