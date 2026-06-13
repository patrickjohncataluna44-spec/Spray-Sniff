module.exports = () => ({
  postcssPlugin: 'unwrap-cascade-layers-for-legacy-mobile',
  AtRule: {
    layer(atRule) {
      if (atRule.nodes) {
        atRule.replaceWith(...atRule.nodes)
        return
      }

      atRule.remove()
    },
  },
})

module.exports.postcss = true
