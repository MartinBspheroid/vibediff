import { describe, it, expect } from 'vitest'
import { isImagePath, imageBlobSrc } from './imageFile'

describe('isImagePath', () => {
  it('recognizes common image extensions (case-insensitive)', () => {
    for (const p of ['a.png', 'b.JPG', 'c.jpeg', 'd.gif', 'e.webp', 'f.svg', 'g.bmp', 'h.ico']) {
      expect(isImagePath(p)).toBe(true)
    }
  })

  it('rejects non-images and extensionless paths', () => {
    for (const p of ['src/app.ts', 'README.md', 'data.bin', 'Makefile', 'a.png.txt']) {
      expect(isImagePath(p)).toBe(false)
    }
  })
})

describe('imageBlobSrc', () => {
  it('builds an encoded blob URL for a side', () => {
    expect(imageBlobSrc('dir/logo.png', 'new')).toBe('/api/blob/dir%2Flogo.png?side=new')
    expect(imageBlobSrc('old name.png', 'old')).toBe('/api/blob/old%20name.png?side=old')
  })
})
