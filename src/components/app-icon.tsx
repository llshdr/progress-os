import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// The Lapis lazuli app mark: a faceted-stone gradient (lighter ultramarine
// catching one corner like a polished facet, deepening to the app's own
// ink background - real lapis is never a flat fill) carrying the sidebar
// wordmark's own italic Fraunces "L" (see app-layout.tsx's "L·A·P·I·S"
// logotype), distilled to a single letter at icon scale, plus a small,
// deliberately asymmetric cluster of gold pyrite flecks in one corner -
// the same restraint the sidebar's own single gold "P" already uses, not
// a sprinkle across the whole face. Every color below is an existing
// Lapis token (globals.css), not a new invented hex.
//
// Fraunces is loaded from a locally bundled TTF (src/fonts/fraunces)
// rather than next/font/google: ImageResponse (Satori) needs raw font
// bytes passed via its `fonts` option, which next/font doesn't expose -
// same "self-host it" precedent already set for General Sans
// (src/fonts/general-sans). Satori also only reads TTF/OTF/WOFF, not
// WOFF2, hence TTF specifically. Read via fs, not fetch(new URL(...,
// import.meta.url)) - the latter is Next.js's documented pattern for this
// but fails at build time under this project's Turbopack setup ("fetch
// failed... not implemented" during /icon's static prerender); a plain
// Node filesystem read has no such dependency on bundler-specific
// asset-URL rewriting.
async function loadFrauncesItalicBold(): Promise<Buffer> {
  return readFile(join(process.cwd(), 'src/fonts/fraunces/Fraunces-Italic-Bold.ttf'))
}

export async function renderAppIcon(size: number) {
  const fraunces = await loadFrauncesItalicBold()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: 'linear-gradient(135deg, #5B72E3 0%, #2E4BD4 40%, #12151F 76%, #0A0C12 100%)',
        }}
      >
        {/* Glossy highlight - light catching one facet unevenly, not a
            uniform sheen. */}
        <div
          style={{
            position: 'absolute',
            top: size * -0.18,
            left: size * -0.12,
            width: size * 0.85,
            height: size * 0.85,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0) 68%)',
            display: 'flex',
          }}
        />

        {/* Gold pyrite flecks - one real cluster (upper right), not an
            even sprinkle - matches how pyrite actually inclusions in
            real lapis lazuli stone. */}
        <div
          style={{
            position: 'absolute',
            top: size * 0.15,
            right: size * 0.16,
            width: size * 0.05,
            height: size * 0.05,
            borderRadius: '50%',
            background: '#E0BD74',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: size * 0.095,
            right: size * 0.29,
            width: size * 0.026,
            height: size * 0.026,
            borderRadius: '50%',
            background: '#C9A24B',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: size * 0.25,
            right: size * 0.085,
            width: size * 0.018,
            height: size * 0.018,
            borderRadius: '50%',
            background: '#C9A24B',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: size * 0.21,
            left: size * 0.15,
            width: size * 0.028,
            height: size * 0.028,
            borderRadius: '50%',
            background: '#C9A24B',
            display: 'flex',
          }}
        />

        {/* The mark - the sidebar wordmark's own italic Fraunces "L". */}
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontFamily: 'Fraunces',
              fontStyle: 'italic',
              fontWeight: 700,
              fontSize: size * 0.6,
              color: '#F3F4F7',
            }}
          >
            L
          </span>
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
      fonts: [{ name: 'Fraunces', data: fraunces, style: 'italic', weight: 700 }],
    }
  )
}
