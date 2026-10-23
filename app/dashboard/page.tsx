import { CommandCenter } from '@/components/command-center'
import { FirstRunGuide } from '@/components/first-run-guide'

export default function DashboardPage() {
  return (
    <div className="min-w-0 space-y-6">
      <FirstRunGuide />
      <CommandCenter />
    </div>
  )
}
