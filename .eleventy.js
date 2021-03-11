module.exports = function(eleventyConfig) {
  // copy static assets straight through to final site
  eleventyConfig.addPassthroughCopy('assets')
  //eleventyConfig.addGlobalData('siteEmail', 'glynn.bird@gmail.com')
  //eleventyConfig.addGlobalData('siteTwitter', '@glynn_bird')
}
