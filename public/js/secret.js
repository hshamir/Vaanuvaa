window.addBlock = function addBlock(type, after, data){
	var self = $(this);
	var render = jade.render("article-" + type);
	var el = $(render);
	el.attr("data-type", type);
	if(data){
		switch(type){
			case "paragraph-dv":
				el.find("textarea").val(data.content);
				
				break;
			case "image":
				if(data && data.file && data.file.sizes){
					el.find(".selected-image").html('<img src="'+data.file.sizes.box+'" data-id="'+data.content+'" />');
				}
				break;
			case "tweet":
				el.find("input").val();
				break;
			case "youtube":
				if(data.content.indexOf('embed') == -1){
					data.content.replace("embed/","watch?v=");
				}					
				el.find("input").val(data.content);
				break;
		}
		el.attr("data-time", data.time);
		el.attr("data-user", data.user);
		el.attr("data-ip", data.ip);
	}
	if(!after){
		$("#article-sections").append(el);
	}else{
		el.insertAfter(after);
	}
	autosize(el.find("textarea"))
}
$(function(){
	$(".thaana").thaana();
	
	$("body").on("click", ".toolbar-item", function(){
		var self = $(this);
		var type = self.data().type;
		var parent = self.closest('.article-section');
		addBlock(type, parent);
	});

	$("body").on("keyup", ".article-section[data-type='image'] input", function(e){
		var val = $(this).val();
		var imgc = $(this).closest('.article-section').find('.images');
		superagent
		.get('/media/find')
		.query({type:'image', query:val})
		.end(function(err, res){
			if(err){
				return alert(err);
			}
			var img = res.body.map(function(i){
				if(i.file.sizes && i.file.sizes.box)
				return ('<img data-box-img="'+i.file.sizes.box+'" data-id="'+i._id+'" src="'+i.file.sizes.xs+'"/>')
			}).join('');
			imgc.html(img);
		})
	});
	$("body").on("click", ".article-section[data-type='image'] .images img", function(e){
		var id = $(this).attr('data-id');
		var box_img = $(this).attr('data-box-img');
		var id = $(this).attr('data-id');
		var imgc = $(this).closest('.article-section').find('.selected-image');
		imgc.html('<img data-id="'+id+'" src="'+box_img+'" />');
		
	})
	$("body").on("keydown", ".article-section[data-type='paragraph-dv'] textarea", function(e){

	});
	//tweet
	$("body").on("change", ".article-tweet", function(){
		var parent = $(this).parent();
		var url = $(this).val();
		if(!url){
			return;
		}
		parent.find(".tweet-display").html('<blockquote class="twitter-tweet" lang="en"><a href="'+url+'"></blockquote><script async src="//platform.twitter.com/widgets.js" charset="utf-8"></script>');
	});
	$("body").on("change", ".article-youtube", function(){
		var parent = $(this).parent();
		var url = $(this).val();
		if(!url){
			return;
		}
		if(url.indexOf('embed') == -1){
			url = url.replace("watch?v=", "embed/");
		}
		parent.find(".youtube-display").html('<iframe controls=0 frameborder="0" src="'+url+'"></iframe');
	});


	$("body").on("click", ".remove-block", function(){
		var c = confirm("Do you want to remove?");
		if(c){
			$(this).parent().parent().remove();
		}
	})
	$("body").on('click', '.add-image', function(){
		var search = $(this).closest('.article-section').find('input');
		$('#modal-add-image').data('target', search)
		$('#modal-add-image').modal('show')
	});
	$("body").on('click', '#add-image', function(e){
		e.preventDefault();
		e.stopPropagation();
		var self = $(this);
		var form = $("#add-image-form").serializeJSON();
		if(form.description_dv == "" && form.description_en == ""){
			return alert("At least one description field must be filled.")
		}
		var fd = new FormData();
		for(var i in form){
			fd.append(i, form[i]);
		}
		var file =  $("#new-image-file").get(0).files[0];
		if(!file){
			return fn("please select a file");
		}
		fd.append('file',file);
		superagent
		.post('/media/image')
		.send(fd)
		.end(function(err, res){
			if(err){
				return alert(err);
			}
			var b = res.body;
			if(b.error){
				return alert(b.error);
			}
			$('#modal-add-image').modal('hide')
			$('#add-image-form textarea').val('')
			$('#add-image-form input[type="text"]').val('')
			$("#new-image-file").parent().html($("#new-image-file").parent().html())
			var t = $('#modal-add-image').data('target')
			t.val(b._id);
			t.trigger('keyup');
			var imgc = t.closest('.article-section').find('.selected-image');
			imgc.html('<img data-id="'+b._id+'" src="'+b.file.sizes.box+'" />');
		})
	})
});

