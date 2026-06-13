const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export const SORT_INITIALS = `${LETTERS}#`

const PINYIN_BOUNDARIES = [
  ['A', '阿'],
  ['B', '芭'],
  ['C', '嚓'],
  ['D', '咑'],
  ['E', '妸'],
  ['F', '发'],
  ['G', '旮'],
  ['H', '铪'],
  ['J', '丌'],
  ['K', '咔'],
  ['L', '垃'],
  ['M', '嘸'],
  ['N', '拏'],
  ['O', '噢'],
  ['P', '妑'],
  ['Q', '七'],
  ['R', '呥'],
  ['S', '仨'],
  ['T', '他'],
  ['W', '屲'],
  ['X', '夕'],
  ['Y', '丫'],
  ['Z', '帀']
] as const

function getChineseInitial(char: string) {
  const code = char.charCodeAt(0)
  if (code < 0x4e00 || code > 0x9fa5) return ''
  for (let index = PINYIN_BOUNDARIES.length - 1; index >= 0; index -= 1) {
    const [letter, boundary] = PINYIN_BOUNDARIES[index]
    if (char.localeCompare(boundary, 'zh-Hans-CN-u-co-pinyin') >= 0) return letter
  }
  return ''
}

export function getInitial(name: string) {
  const first = String(name || '').trim().charAt(0)
  if (!first) return '#'
  const upper = first.toUpperCase()
  if (/^[A-Z]$/.test(upper)) return upper
  const initial = getChineseInitial(first)
  return initial && LETTERS.includes(initial) ? initial : '#'
}
