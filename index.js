var Mustache = require('mustache');

var data = {
  url : "https://medium.com/ibm-watson-data-lab/nodebooks-node-js-data-science-notebooks-aa140bea21ba", 
  title: "Nodebooks - Node.js in Jupyter notebooks (part 1)",
  npm: null,
  github: "https://github.com/ibm-watson-data-lab/pixiedust_node",
  article: "https://medium.com/ibm-watson-data-lab/nodebooks-node-js-data-science-notebooks-aa140bea21ba",
  description: "Developers can use notebooks too, for prototyping, data exploration and visualisation of results. If you're a Node.js developer, check out pixiedust_node for Jupyter notebooks",
  tags: ["Node.js","Notebooks","Jupyter"]
};
 
var fs = require('fs');
var template = fs.readFileSync('template.html', {encoding: 'utf8'});
var output = Mustache.render(template, data);
console.log(output);