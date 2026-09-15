'use client'

import { Sparkles } from 'lucide-react'

export function TechUnifiedBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center ${compact ? 'justify-center' : 'gap-3'}`} aria-label="TechUnified AI OS">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Sparkles aria-hidden="true" />
      </div>
      {!compact && (
        <div>
          <div className="font-semibold tracking-tight">TECHUNIFIED</div>
          <div className="text-[10px] uppercase tracking-[.24em] text-muted-foreground">AI OS</div>
        </div>
      )}
    </div>
  )
}
