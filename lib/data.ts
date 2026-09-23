export type Status =
  | 'Running'
  | 'Paused'
  | 'Draft'
  | 'Needs Attention'
  | 'Indexed'
  | 'Processing'
  | 'Failed'

export type Role =
  | 'Owner'
  | 'Admin'
  | 'Manager'
  | 'Member'
  | 'Viewer'

export interface Department {
  id: string
  name: string
  description: string
  agents: number
  active: number
  icon: string
  status: string
}

export interface Agent {
  id: string
  name: string
  department: string
  purpose: string
  status: Status
  model: string
  lastActivity: string
  tasks: number
}

export interface Activity {
  actor: string
  action: string
  department: string
  status: string
  time: string
}

import type { LucideIcon } from 'lucide-react'

import {
  Activity,
  BarChart3,
  Bot,
  Brain,
  BriefcaseBusiness,
  Building2,
  Database,
  FileBarChart,
  Gauge,
  GitBranch,
  History,
  LayoutDashboard,
  Lightbulb,
  Plug,
  Settings,
  ShoppingCart,
  Sparkles,
  Users,
  Workflow,
} from 'lucide-react'

export type NavigationItem = {
  label: string
  href: string
  icon: LucideIcon
}

export type NavigationGroup = {
  label: string
  items: NavigationItem[]
}

export const navGroups: NavigationGroup[] = [
  {
    label: 'Main',
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
      },
      {
        label: 'Company Brain',
        href: '/brain',
        icon: Brain,
      },
      {
        label: 'Business Analyst',
        href: '/business-analyst',
        icon: Lightbulb,
      },
    ],
  },

  {
    label: 'AI & Automation',
    items: [
      {
        label: 'AI Agents',
        href: '/agents',
        icon: Bot,
      },
      {
        label: 'AI Studio',
        href: '/studio',
        icon: Sparkles,
      },
      {
        label: 'Workflows',
        href: '/workflows',
        icon: Workflow,
      },
      {
        label: 'Automations',
        href: '/automations',
        icon: GitBranch,
      },
    ],
  },

  {
    label: 'Intelligence',
    items: [
      {
        label: 'Analytics',
        href: '/analytics',
        icon: BarChart3,
      },
      {
        label: 'Decision Engine',
        href: '/business-analyst/decisions',
        icon: Lightbulb,
      },
      {
        label: 'Forecast',
        href: '/business-analyst/forecast',
        icon: Gauge,
      },
      {
        label: 'Reports',
        href: '/reports',
        icon: FileBarChart,
      },
      {
        label: 'Inspector',
        href: '/business-analyst/inspector',
        icon: Activity,
      },
    ],
  },

  {
    label: 'Business',
    items: [
      {
        label: 'Departments',
        href: '/departments',
        icon: Building2,
      },
      {
        label: 'Services',
        href: '/services',
        icon: BriefcaseBusiness,
      },
      {
        label: 'Customers',
        href: '/customers',
        icon: Users,
      },
      {
        label: 'Sales',
        href: '/sales',
        icon: ShoppingCart,
      },
    ],
  },

  {
    label: 'Connect',
    items: [
      {
        label: 'Integrations',
        href: '/integrations',
        icon: Plug,
      },
      {
        label: 'Knowledge Sources',
        href: '/brain/data-sources',
        icon: Database,
      },
    ],
  },

  {
    label: 'System',
    items: [
      {
        label: 'Settings',
        href: '/settings',
        icon: Settings,
      },
      {
        label: 'Activity',
        href: '/activity',
        icon: History,
      },
    ],
  },
]

export const nav = navGroups.flatMap(
  (group) => group.items,
)

export const modelTypes = [
  'GPT-4o',
  'Claude 3.5 Sonnet',
  'Gemini 1.5 Pro',
]
