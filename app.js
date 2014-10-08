// app.js

var express = require('express'),
  app = express()
  
//setup static public directory
app.use(express.static(__dirname + '/public')); 

// use the jade templating engine
app.set('view engine', 'jade');

// render index page
app.get('/', function(req, res){
  res.render('index',{ });
});

app.use(function(req, res, next){
  res.redirect("/");
});

// The IP address of the Cloud Foundry DEA (Droplet Execution Agent) that hosts this application:
var host = (process.env.VCAP_APP_HOST || 'localhost');
// The port on the DEA for communication with the application:
var port = (process.env.VCAP_APP_PORT || 3000);
// Start server
app.listen(port, host);
console.log('App started on port ' + port);


