import type { Ref } from '../types/diff'

interface TargetSelectorProps {
  refs: Ref[]
  value: string
  onChange: (target: string) => void
}

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
      <select
        value={value}
        onChange={(e) => { onChange(e.target.value); }}
        aria-label="Compare against"
        className="bg-[#2f363d] dark:bg-[#21262d] text-white border border-[#444c56] dark:border-[#30363d] rounded-md px-2 py-1 cursor-pointer
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff] focus-visible:ring-offset-1 focus-visible:ring-offset-[#24292e]"
      >
        <option value="">Working tree (default)</option>
        {branches.length > 0 && (
          <optgroup label="Branches">
            {branches.map((b) => (
              <option key={`branch-${b.name}`} value={b.name}>
                {b.current ? `${b.name} (current)` : b.name}
              </option>
            ))}
          </optgroup>
        )}
        {tags.length > 0 && (
          <optgroup label="Tags">
            {tags.map((t) => (
              <option key={`tag-${t.name}`} value={t.name}>{t.name}</option>
            ))}
          </optgroup>
        )}
      </select>
    </label>
  )
}
