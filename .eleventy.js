const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");

module.exports = function(eleventyConfig) {
  // copy static assets straight through to final site
  eleventyConfig.addPassthroughCopy('assets')
  eleventyConfig.addPlugin(syntaxHighlight);
}
