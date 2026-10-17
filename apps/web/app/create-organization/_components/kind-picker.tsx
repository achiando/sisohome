'use client'

import { Building2, Briefcase, Megaphone, Wrench, type LucideIcon } from 'lucide-react'

import { RadioGroup, RadioGroupItem } from '@workspace/ui/components/radio-group'

export type OrgKind =
  | 'LANDLORD'
  | 'PROPERTY_MANAGEMENT'
  | 'MAINTENANCE_COMPANY'
  | 'MARKETING_AGENT'

export const ORG_KINDS: { value: OrgKind; label: string; icon: LucideIcon; desc: string }[] = [
  {
    value: 'LANDLORD',
    label: 'Landlord',
    icon: Building2,
    desc: 'I own and manage my own properties.',
  },
  {
    value: 'PROPERTY_MANAGEMENT',
    label: 'Property Management',
    icon: Briefcase,
    desc: 'I run a company managing properties for owners.',
  },
  {
    value: 'MAINTENANCE_COMPANY',
    label: 'Maintenance Company',
    icon: Wrench,
    desc: 'I run a maintenance / service business.',
  },
  {
    value: 'MARKETING_AGENT',
    label: 'House Marketing',
    icon: Megaphone,
    desc: 'I market homes and hand tenants off to landlords or management.',
  },
]

interface KindPickerProps {
  value: OrgKind | null
  onChange: (kind: OrgKind) => void
  disabled?: boolean
}

/** Organization kind selection — design-system RadioGroup (one card per kind). */
export function KindPicker({ value, onChange, disabled }: KindPickerProps) {
  return (
    <RadioGroup
      value={value ?? ''}
      onValueChange={(v) => onChange(v as OrgKind)}
      disabled={disabled}
    >
      {ORG_KINDS.map((k) => (
        <RadioGroupItem
          key={k.value}
          value={k.value}
          label={
            <span className="flex items-center gap-2">
              <k.icon className="size-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">{k.label}</span>
            </span>
          }
          description={k.desc}
        />
      ))}
    </RadioGroup>
  )
}
