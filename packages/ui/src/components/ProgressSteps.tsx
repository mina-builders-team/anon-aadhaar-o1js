'use client'
import { useState } from 'react'

export type StepStatus = 'active' | 'done' | 'error'

export type StepItem = {
  id: string
  label: string
  status: StepStatus
}

type Props = {
  title?: string
  steps: StepItem[]
  collapsible?: boolean
  defaultCollapsed?: boolean
}

export function ProgressSteps({
  title,
  steps,
  collapsible = true,
  defaultCollapsed = false,
}: Props) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  const statusIcon = (status: StepStatus) => {
    switch (status) {
      case 'done':
        return (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-600 text-white text-xs">
            ✓
          </span>
        )
      case 'active':
        return (
          <span className="inline-block w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
        )
      case 'error':
        return (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-xs">
            !
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {title && (
          <h3 className="text-sm font-semibold text-gray-300">{title}</h3>
        )}
        {collapsible && (
          <button
            className="text-xs text-gray-400 hover:text-gray-200"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? 'Show' : 'Hide'}
          </button>
        )}
      </div>
      {!collapsed && (
        <ul className="mt-2 space-y-2">
          {steps.map((s) => (
            <li key={s.id} className="flex items-start gap-2 text-sm">
              <div className="mt-0.5">{statusIcon(s.status)}</div>
              <div className="flex-1">
                <div className="text-gray-200">{s.label}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
