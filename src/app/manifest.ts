import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'L.A.P.I.S',
    short_name: 'L.A.P.I.S',
    description: 'Personal operating system for ambitious people',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0A0C12',
    theme_color: '#0A0C12',
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
