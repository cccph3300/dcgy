import { unlink } from 'node:fs/promises'
import { basename, join } from 'node:path'

export function cleanupRetailImage(imageUrl: string | null | undefined) {
  if (!imageUrl || !imageUrl.startsWith('/uploads/retail/')) return
  const filename = basename(imageUrl)
  if (!/^[a-zA-Z0-9.-]+$/.test(filename)) return
  unlink(join(process.cwd(), 'uploads', 'retail', filename)).catch(() => {})
}
