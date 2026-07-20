import { ImageResponse } from 'next/og'

// Simple placeholder app icon — a monogram on the app's own dark background,
// until real branding replaces it. Shared by icon.tsx and apple-icon.tsx so
// the two stay visually identical.
export function renderAppIcon(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000000',
          color: '#ffffff',
          fontSize: size * 0.55,
          fontWeight: 700,
        }}
      >
        L
      </div>
    ),
    { width: size, height: size }
  )
}
