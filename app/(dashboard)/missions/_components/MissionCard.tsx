'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

interface MissionCardProps {
  id: string
  title: string
  description: string
  budget: number
  duration: string
  jeh: number
  requirements: string
  featured?: boolean
}

export function MissionCard({
  id,
  title,
  description,
  budget,
  duration,
  jeh,
  requirements,
  featured
}: MissionCardProps) {
  if (featured) {
    return (
      <div className="lg:col-span-8 bg-white rounded-xl p-8 flex flex-col justify-between group cursor-pointer hover:shadow-xl transition-all duration-300 relative overflow-hidden border border-slate-100">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#C9A84C]/10 rounded-bl-full -mr-10 -mt-10 group-hover:scale-125 transition-transform" />

        <div className="relative">
          <div className="flex justify-between items-start mb-6">
            <span className="px-3 py-1 bg-[#0D1B2A] text-white text-xs font-bold tracking-widest uppercase rounded-full">
              High Priority
            </span>
            <span className="text-[#0D1B2A] font-headline font-black text-2xl">€{budget.toLocaleString()}</span>
          </div>

          <h3 className="text-3xl font-bold font-headline mb-4 group-hover:text-[#0D1B2A] transition-colors">
            {title}
          </h3>
          <p className="text-slate-600 mb-8 leading-relaxed max-w-xl">{description}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-slate-100">
          <div>
            <span className="text-xs uppercase font-bold text-slate-400 block mb-1">Duration</span>
            <p className="text-sm font-semibold text-[#0D1B2A]">{duration}</p>
          </div>
          <div>
            <span className="text-xs uppercase font-bold text-slate-400 block mb-1">JEH</span>
            <p className="text-sm font-semibold text-[#0D1B2A]">{jeh} Days</p>
          </div>
          <div>
            <span className="text-xs uppercase font-bold text-slate-400 block mb-1">Required</span>
            <p className="text-sm font-semibold text-[#0D1B2A]">{requirements}</p>
          </div>
          <div className="flex justify-end items-end">
            <Button className="bg-[#0D1B2A] hover:bg-[#0D1B2A]/90">
              Details <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card className="p-6 flex flex-col justify-between hover:shadow-lg transition-all cursor-pointer border border-slate-100">
      <div>
        <div className="h-12 w-12 bg-slate-100 rounded-lg flex items-center justify-center mb-6">
          <span className="text-[#0D1B2A] font-bold">📊</span>
        </div>
        <h4 className="text-lg font-bold font-headline mb-2 text-[#0D1B2A]">{title}</h4>
        <p className="text-sm text-slate-600 line-clamp-3">{description}</p>
      </div>
      <div className="mt-8 pt-4 border-t border-slate-100 flex justify-between items-center">
        <span className="text-[#0D1B2A] font-bold">€{budget.toLocaleString()}</span>
        <span className="text-xs font-semibold text-slate-500">{jeh} JEH</span>
      </div>
    </Card>
  )
}
