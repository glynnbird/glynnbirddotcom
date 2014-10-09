var onReady = function() {
  $('#me').hover(function(x){
    $('#me').removeClass("faded");
  },function(y) {
    $('#me').addClass("faded");
  });
};

$( document ).ready( onReady );

