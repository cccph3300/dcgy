export const RETAIL_CATEGORIES = [
  { value: 'special', label: '特价' },
  { value: 'imported', label: '进口果' },
  { value: 'domestic', label: '国产果' },
  { value: 'gift', label: '礼盒装' },
  { value: 'dry', label: '干货' }
]

export function categoryText(value) {
  const item = RETAIL_CATEGORIES.find(category => category.value === value)
  return item ? item.label : value
}

export function sourceText(value) {
  return value === 'stock' ? '库存' : '代卖'
}

export function unitText(value) {
  return value === 'weight' ? '按重量' : '按数量'
}

export function retailStatusText(value) {
  return value === 'paid' ? '已付' : '未付'
}
