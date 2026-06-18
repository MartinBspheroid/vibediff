import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'text-foreground',
        added: 'border-transparent bg-[#dafbe1] text-[#1a7f37] dark:bg-[#1f362d] dark:text-[#3fb950]',
        modified: 'border-transparent bg-[#fff8c5] text-[#9a6700] dark:bg-[#3d2e00] dark:text-[#d29922]',
        deleted: 'border-transparent bg-[#ffebe9] text-[#cf222e] dark:bg-[#3d1e20] dark:text-[#f85149]',
        renamed: 'border-transparent bg-[#ddf4ff] text-[#0969da] dark:bg-[#1c2e3d] dark:text-[#58a6ff]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps): React.ReactElement {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
