import { redirect } from 'next/navigation'

// Suggestions moved back onto the dashboard directly - this route just
// catches old links/bookmarks/PWA shortcuts rather than 404ing.
export default function TodayPage() {
  redirect('/dashboard')
}
