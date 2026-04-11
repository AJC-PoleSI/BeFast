'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  FileText,
  Calendar,
  Settings,
  HelpCircle,
  Plus,
  ShieldAlert
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Sidebar() {
  const pathname = usePathname()

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/missions', label: 'Mission Catalog', icon: FileText },
    { href: '/etudes', label: 'Study Management', icon: Calendar },
    { href: '/dashboard/profil', label: 'Profile', icon: ShieldAlert }
  ]

  const bottomItems = [
    { href: '#', label: 'Settings', icon: Settings },
    { href: '#', label: 'Support', icon: HelpCircle }
  ]

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-100 dark:bg-slate-900 flex flex-col py-6 z-50 border-r border-slate-200 dark:border-slate-800">
      {/* Logo */}
      <div className="px-6 mb-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0D1B2A] flex items-center justify-center">
            <span className="text-[#C9A84C] font-bold text-lg">B</span>
          </div>
          <div>
            <h1 className="font-manrope font-extrabold text-xl text-[#0D1B2A] dark:text-blue-200 tracking-tight">
              BeFast
            </h1>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Strategic Command
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg font-manrope text-sm font-medium tracking-tight transition-colors duration-200',
                isActive
                  ? 'text-[#0D1B2A] bg-slate-200 dark:text-[#C9A84C] dark:bg-slate-800'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="px-4 space-y-4">
        <Button className="w-full bg-[#0D1B2A] hover:bg-[#0D1B2A]/90 text-white gap-2">
          <Plus className="w-4 h-4" />
          New Mission
        </Button>

        <div className="space-y-1 pt-4 border-t border-slate-200 dark:border-slate-800">
          {bottomItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors"
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
