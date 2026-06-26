import Prism from 'prismjs'

// Keep the initial bundle focused on the languages most likely to appear in
// this repo and in typical frontend/backend diffs. Less common grammars are
// loaded on demand by ensureLanguageLoaded().
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-diff'

type LazyLanguageLoader = () => Promise<unknown>

const lazyLanguages = {
  c: async () => import('prismjs/components/prism-c'),
  cpp: async () => {
    await import('prismjs/components/prism-c')
    await import('prismjs/components/prism-cpp')
  },
  csharp: async () => import('prismjs/components/prism-csharp'),
  dart: async () => import('prismjs/components/prism-dart'),
  docker: async () => import('prismjs/components/prism-docker'),
  elixir: async () => import('prismjs/components/prism-elixir'),
  erlang: async () => import('prismjs/components/prism-erlang'),
  graphql: async () => import('prismjs/components/prism-graphql'),
  haskell: async () => import('prismjs/components/prism-haskell'),
  java: async () => import('prismjs/components/prism-java'),
  kotlin: async () => import('prismjs/components/prism-kotlin'),
  lua: async () => import('prismjs/components/prism-lua'),
  makefile: async () => import('prismjs/components/prism-makefile'),
  nginx: async () => import('prismjs/components/prism-nginx'),
  perl: async () => import('prismjs/components/prism-perl'),
  php: async () => {
    await import('prismjs/components/prism-markup-templating')
    await import('prismjs/components/prism-php')
  },
  powershell: async () => import('prismjs/components/prism-powershell'),
  protobuf: async () => import('prismjs/components/prism-protobuf'),
  python: async () => import('prismjs/components/prism-python'),
  r: async () => import('prismjs/components/prism-r'),
  ruby: async () => import('prismjs/components/prism-ruby'),
  rust: async () => import('prismjs/components/prism-rust'),
  sass: async () => import('prismjs/components/prism-sass'),
  scala: async () => import('prismjs/components/prism-scala'),
  scss: async () => import('prismjs/components/prism-scss'),
  sql: async () => import('prismjs/components/prism-sql'),
  swift: async () => import('prismjs/components/prism-swift'),
  toml: async () => import('prismjs/components/prism-toml'),
  vim: async () => import('prismjs/components/prism-vim'),
} satisfies Record<string, LazyLanguageLoader>

const loadingLanguages = new Map<string, Promise<void>>()

export function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''

  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'jsx',
    'ts': 'typescript',
    'tsx': 'tsx',
    'go': 'go',
    'py': 'python',
    'java': 'java',
    'rs': 'rust',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'md': 'markdown',
    'sh': 'bash',
    'bash': 'bash',
    'html': 'html',
    'xml': 'xml',
    'sql': 'sql',
    'rb': 'ruby',
    'php': 'php',
    'c': 'c',
    'cpp': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'cs': 'csharp',
    'swift': 'swift',
    'kt': 'kotlin',
    'kts': 'kotlin',
    'scala': 'scala',
    'r': 'r',
    'pl': 'perl',
    'dockerfile': 'docker',
    'toml': 'toml',
    'ini': 'ini',
    'graphql': 'graphql',
    'gql': 'graphql',
    'ex': 'elixir',
    'exs': 'elixir',
    'erl': 'erlang',
    'hrl': 'erlang',
    'hs': 'haskell',
    'lua': 'lua',
    'dart': 'dart',
    'ps1': 'powershell',
    'vim': 'vim',
    'makefile': 'makefile',
    'mk': 'makefile',
    'proto': 'protobuf',
  }

  return languageMap[ext] || 'plaintext'
}

export function hasLanguageLoaded(language: string): boolean {
  return language in Prism.languages
}

export async function ensureLanguageLoaded(language: string): Promise<void> {
  if (hasLanguageLoaded(language)) return

  const loader = (lazyLanguages as Partial<Record<string, LazyLanguageLoader>>)[language]
  if (!loader) return

  const existing = loadingLanguages.get(language)
  if (existing) {
    await existing
    return
  }

  const promise = (async () => {
    await loader()
  })()
  loadingLanguages.set(language, promise)
  await promise
}

// Highlight a string of code
export function highlightCode(code: string, language: string): string {
  if (!(language in Prism.languages)) {
    return Prism.util.encode(code) as string
  }

  return Prism.highlight(code, Prism.languages[language], language)
}
