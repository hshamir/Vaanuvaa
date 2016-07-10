$(function(){
	$('.slides').cycle({
		fx: 'fade',
		timeOut: 6000
	});
	$("#catering_popup").click(function(){$(this).fadeOut()})
	$("#catering_information h4").click(function(){
		var price = $(this).attr('data-price')
		var name = $(this).text() + (price ? " ("+price+")" : "");
		var food = $(this).attr('data-food');
		food = JSON.parse(food);
		$("#catering_popup_contents h2").text(name);
		$("#catering_popup_contents ul").html($.map(food, function(v,k){
			return '<li>'+v+'</li>'
		}).join(''))
		$("#catering_popup").fadeIn()
	})
})

  var _gaq = _gaq || [];
  _gaq.push(['_setAccount', 'UA-35940121-1']);
  _gaq.push(['_setDomainName', 'lemongrass.com.mv']);
  _gaq.push(['_trackPageview']);

  (function() {
    var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
    ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
    var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
  })();

