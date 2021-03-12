module.exports = function(eleventyConfig) {
  // copy static assets straight through to final site
  eleventyConfig.addPassthroughCopy('assets')
  eleventyConfig.addPassthroughCopy('CNAME')
}
