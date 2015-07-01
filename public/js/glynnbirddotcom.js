var U = "https://54a13c72-3351-4bb4-a93c-79a723b29443-bluemix.cloudant.com/glynnbirdcom";
var db = null;

var render = function(f) {
  var func = null;
  var opts = {descending: true, include_docs:true}
  if(typeof f == "undefined" || f.length==0) {
    func = function(doc){ emit(doc.date,null)};
    $('#removefilter').hide();
  } else {
    func = function(doc) { for(var i in doc.tags) { emit([doc.tags[i], doc.date], null)} };  
    opts.endkey=[f];
    opts.startkey=[f+"z"];  
    $('#removefilter').show();
  }
  db.query(func, opts ,  function(err, data) {
    console.log(err, data);
    var html = '<div class="row">\n';
    var col = row = 0;
    for(var i in data.rows) {
      var doc = data.rows[i].doc;
      html += '  <div class="col-lg-4">\n';
      html += '    <div class="alert palette' + (((row + col + 1) % 3)+1) + ' topthing">\n';
      if (doc.git_url) {
        html += '      <a href="' + doc.git_url + '"><img id="forkme" style="position: absolute; top: 0; right: 0; border: 0; margin-right:15px" src="https://camo.githubusercontent.com/365986a132ccd6a44c23a9169022c0b5c890c387/68747470733a2f2f73332e616d617a6f6e6177732e636f6d2f6769746875622f726962626f6e732f666f726b6d655f72696768745f7265645f6161303030302e706e67" alt="Fork me on GitHub" data-canonical-src="https://s3.amazonaws.com/github/ribbons/forkme_right_red_aa0000.png"></a>\n';
      }
      html += '        <h2><a href="' + doc.url + '">' + doc.name + '</a></h2>\n';
      if (doc.image_url) {
        html += '        <img src="' + doc.image_url + '" class="pull-right">\n'
      }
      html += '        <div>' + doc.description + '</div>\n'
      if (doc.npm_url) {
        html += '<div><a href="' + doc.npm_url + '"><img src="/img/npm.png">&nbsp;<i class="fa fa-arrow-right"></i></a></div>';
      }
      if (doc.blog_url) {
        html += '<div><a href="' + doc.blog_url + '">Article <i class="fa fa-arrow-right"></i></a></div>';
      }
      if (doc.demo_url) {
        html += '<div><a href="' + doc.demo_url + '">Demo <i class="fa fa-arrow-right"></i></a></div>';
      }
      html += '<div class="foot">\n';
      for (var k in doc.tags) {
        html += '  <span class="label label-primary spc">';
        html += '<a class="filter" href="Javascript:filter(\'' +  doc.tags[k] + '\')">' + doc.tags[k] + '</a>';
        html += '</span> \n'
      }
      html += '</div>'
      html += '      <div class="clearfix"></div>\n';
      html += '    </div>\n';
      html += '  </div>\n';
      col++;
      if (col==3) {
        html += '</div>\n';
        html += '<div class="row">\n';
        row++;
        col=0;
      }
    }
    html += '</div>';
    $('#content').html(html);
  });
  
}

var filter = function(f) {
  render(f);
};

var onReady = function() {
  $('#me').hover(function(x){
    $('#me').removeClass("faded");
  },function(y) {
    $('#me').addClass("faded");
  });
  
  console.log("POUCH");
  db = new PouchDB("glynnbirdcom");
  console.log("REPLICATE");
  render();
  db.replicate.from(U).on('change', function (info) {
  // handle change
      console.log("CHANGE",info)
  }).on('paused', function () {
    // replication paused (e.g. user went offline)
  }).on('active', function () {
    // replicate resumed (e.g. user went back online)
      console.log("ACTIVE")
  }).on('denied', function (info) {
    // a document failed to replicate, e.g. due to permissions
      console.log("DENIED",info)
    
  }).on('complete', function (info) {
    // handle complete
    console.log("COMPLETE",info);
    render();
    
  }).on('error', function (err) {
    // handle error
      console.log("ERROR",err)
    
  });

};

$( document ).ready( onReady );

