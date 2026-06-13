function splitTopLevelWhitespace(value) {
  const parts = []
  let current = ''
  let depth = 0

  for (const char of value) {
    if (char === '(') {
      depth += 1
    } else if (char === ')' && depth > 0) {
      depth -= 1
    }

    if (/\s/.test(char) && depth === 0) {
      if (current) {
        parts.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (current) {
    parts.push(current)
  }

  return parts
}

function physicalFallbacks(prop, value) {
  const values = splitTopLevelWhitespace(value)
  const first = values[0] ?? value
  const second = values[1] ?? first

  switch (prop) {
    case 'padding-inline':
      return [
        ['padding-left', first],
        ['padding-right', second],
      ]
    case 'padding-inline-start':
      return [['padding-left', value]]
    case 'padding-block':
      return [
        ['padding-top', first],
        ['padding-bottom', second],
      ]
    case 'padding-inline-end':
      return [['padding-right', value]]
    case 'margin-inline':
      return [
        ['margin-left', first],
        ['margin-right', second],
      ]
    case 'margin-inline-start':
      return [['margin-left', value]]
    case 'margin-inline-end':
      return [['margin-right', value]]
    case 'margin-block':
      return [
        ['margin-top', first],
        ['margin-bottom', second],
      ]
    case 'margin-block-start':
      return [['margin-top', value]]
    case 'margin-block-end':
      return [['margin-bottom', value]]
    case 'inset-inline':
      return [
        ['left', first],
        ['right', second],
      ]
    case 'inset-inline-start':
      return [['left', value]]
    case 'inset-inline-end':
      return [['right', value]]
    case 'inset-block':
      return [
        ['top', first],
        ['bottom', second],
      ]
    case 'border-block-width':
      return [
        ['border-top-width', first],
        ['border-bottom-width', second],
      ]
    case 'border-block-style':
      return [
        ['border-top-style', first],
        ['border-bottom-style', second],
      ]
    case 'scroll-padding-block':
      return [
        ['scroll-padding-top', first],
        ['scroll-padding-bottom', second],
      ]
    case 'scroll-margin-block':
      return [
        ['scroll-margin-top', first],
        ['scroll-margin-bottom', second],
      ]
    default:
      return []
  }
}

module.exports = () => ({
  postcssPlugin: 'legacy-mobile-tailwind-output',
  AtRule: {
    layer(atRule) {
      if (atRule.nodes) {
        atRule.replaceWith(...atRule.nodes)
        return
      }

      atRule.remove()
    },
  },
  Declaration(decl) {
    const fallbacks = physicalFallbacks(decl.prop, decl.value)

    for (const [prop, value] of fallbacks) {
      decl.cloneBefore({ prop, value })
    }
  },
})

module.exports.postcss = true
