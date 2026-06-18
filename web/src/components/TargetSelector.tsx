import type { Ref } from '../types/diff'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface TargetSelectorProps {
  refs: Ref[]
  value: string
  onChange: (target: string) => void
}

// Radix Select uses "" as the placeholder sentinel, so the default option needs
// a non-empty value; map it to "" on the way out.
const DEFAULT_VALUE = '__working_tree__'

/**
 * Lets the user pick a branch or tag to compare the working tree against.
 * The empty value means the default (staged/unstaged/all) diff.
 */
export default function TargetSelector({ refs, value, onChange }: TargetSelectorProps): React.ReactElement {
  const branches = refs.filter((r) => r.type === 'branch')
  const tags = refs.filter((r) => r.type === 'tag')

  return (
    <label className="flex items-center gap-1.5 text-sm whitespace-nowrap">
      <span className="text-gray-300 dark:text-[#8b949e]">Compare against</span>
      <Select
        value={value === '' ? DEFAULT_VALUE : value}
        onValueChange={(v) => { onChange(v === DEFAULT_VALUE ? '' : v); }}
      >
        <SelectTrigger aria-label="Compare against" className="min-w-[200px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT_VALUE}>Working tree (default)</SelectItem>
          {branches.length > 0 && (
            <SelectGroup>
              <SelectLabel>Branches</SelectLabel>
              {branches.map((b) => (
                <SelectItem key={`branch-${b.name}`} value={b.name}>
                  {b.current ? `${b.name} (current)` : b.name}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {tags.length > 0 && (
            <SelectGroup>
              <SelectLabel>Tags</SelectLabel>
              {tags.map((t) => (
                <SelectItem key={`tag-${t.name}`} value={t.name}>{t.name}</SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
    </label>
  )
}
