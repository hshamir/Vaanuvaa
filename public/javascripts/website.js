$(function(){
	$("#package-row .rol-package").click(function(e){
		e.preventDefault();
		$("#package-row .rol-package").not().removeClass("active");
		$(this).addClass("active");
		$("#package-row .rol-package .arrow").not().addClass("none");
		$(this).append('<div class="arrow"></div>');
	});
	/*
	var t = new Tour({useLocalStorage: true});
	t.addSteps([
		{
			element:"#logo",
			title:"This is the logo!",
			content:"When clicked it will go to home page"
		}
	]);
	t.start(true);
*/
});
