var U = "https://54a13c72-3351-4bb4-a93c-79a723b29443-bluemix.cloudant.com/glynnbirdcom";
var db = null;

var initServiceWorker = function () {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/serviceworker.js').then(function (registration) {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }).catch(function (err) {
      console.log('ServiceWorker registration failed: ', err);
    });
  } else {
    console.log('ServiceWorker is not supported');
  }
}

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
      html += '  <div class="col s12 m12 l6">\n';
      html += '    <div class="card blue-grey lighten-5 uniform">';  //palette' + (((row + col + 1) % 3)+1) + ' topthing">\n';
      html += '      <div class="card-content">';
      html += '        <span class="card-title"><a class="teal-text text-darken-2" href="' + doc.url + '">' + doc.name + '</a></span>\n';
      html += '<p class="card-body">';
      if (doc.image_url) {
        html += '        <img src="' + doc.image_url + '" class="right">\n'
      }
      html += '        ' + doc.description + '\n';
      html += '</p>'
      if (doc.git_url) {
        html += '      <a class="waves-effect waves-light btn" href="' + doc.git_url + '"><i class="medium material-icons">code</i></a>\n';
      }
      if (doc.npm_url) {
        html += '<a class="waves-effect waves-light btn" href="' + doc.npm_url + '">npm</a>&nbsp;';
      }
      if (doc.blog_url) {
        html += '<a class="waves-effect waves-light btn" href="' + doc.blog_url + '"><i class="medium material-icons">library_books</i></a>&nbsp;';
      }
      if (doc.demo_url) {
        html += '<a class="waves-effect waves-light btn" href="' + doc.demo_url + '"><i class="medium material-icons">play_arrow</i></a>&nbsp;';
      }

      html += '<br /><br />'
      html += '<div class="card-action">\n';
      for (var k in doc.tags) {
        html += '<a class="tag teal-text text-darken-2" href="Javascript:filter(\'' +  doc.tags[k] + '\')">' + doc.tags[k] + '</a>';
      }
      html += '</div>'
            html += '</div>'
      html += '    </div>\n';
      html += '  </div>\n';
      col++;
      if (col==2) {
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

var onReady  = function() {
  db = new PouchDB("glynnbirdcom");
  render();
  db.replicate.from(U).on('complete', function (info) {
    // handle complete
    console.log("Replicaton COMPLETE",info);
    render();
    Materialize.toast('Sync complete', 4000);
    $('#progressbar').hide();
  }).on('error', function (err) {
    // handle error
    console.log("ERROR",err)
    $('#progressbar').hide();
    Materialize.toast('Cannot sync', 4000);
  });
};

window.onload = function () {
 initServiceWorker(); 
 onReady()
};

