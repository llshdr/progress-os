import PlaceholderPage from '@/components/placeholder-page'
import { FolderKanban } from 'lucide-react'

export default function ProjectsPage() {
  return (
    <PlaceholderPage
      icon={FolderKanban}
      title="Projects"
      subtitle="Manage business and personal projects"
      comingSoon="Project management coming soon"
    />
  )
}
