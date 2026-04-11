'use client'

import { Search, Bell, MessageSquare } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function TopBar() {
  return (
    <header className="fixed top-0 right-0 w-[calc(100%-16rem)] h-16 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 flex justify-between items-center px-8">
      <div className="flex items-center gap-8">
        <span className="font-manrope font-black text-lg text-[#0D1B2A] dark:text-blue-100">
          BeFast Management
        </span>
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            className="pl-10 w-64"
            placeholder="Search..."
            type="search"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <nav className="hidden md:flex items-center gap-6">
          <a className="text-slate-600 dark:text-slate-400 font-manrope text-sm font-semibold hover:text-[#0D1B2A] transition-colors">
            KPIs
          </a>
          <a className="text-slate-600 dark:text-slate-400 font-manrope text-sm font-semibold hover:text-[#0D1B2A] transition-colors">
            Resources
          </a>
          <a className="text-slate-600 dark:text-slate-400 font-manrope text-sm font-semibold hover:text-[#0D1B2A] transition-colors">
            Reports
          </a>
        </nav>

        <div className="flex items-center gap-3 pl-6 border-l border-slate-200 dark:border-slate-800">
          <Button variant="ghost" size="icon">
            <Bell className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <MessageSquare className="w-5 h-5" />
          </Button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C9A84C] to-[#0D1B2A]" />
        </div>
      </div>
    </header>
  )
}
