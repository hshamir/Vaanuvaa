var crops = [];
$(function(){
	$('.cms-load').on('click','li',function(e){
		var self = $(this);
		var name = self.attr('cms-name');
		$('.menu-selected').removeClass('menu-selected');
		self.addClass('menu-selected');
		
		$("#loading").show();
		if(self.attr("data-searchable") == 'false'){
			console.log('d');
			$("#component-search-container").hide();
		}else{
			$("#component-search-container").show();
		}
		if(self.attr("static-load")){
			cms.clearComponents();
			
			//get data from sources
			var sources = self.attr('data-sources');
			$.getJSON("/cms/get-data",{sources:sources}, function(res){
				cms.addComponent(self.attr("static-load"), res);
				$("#loading").hide();
			});
			return;
		}
		//block view

		$("#component-search").attr('cms-name', name);
		cms.fetch(name, function(res){
			$("#loading").hide();
			var schema = res.schema;
			cms.clearComponents();
			if(res.statics.single == true){
				if(res.docs.length > 0){
					cms.addComponents(res,name);
				}else{
					cms.addComponent('new-item', null, schema, undefined, res.components);
				}
			}else{
				cms.addComponents(res,name);
				cms.addComponent('new-item', null, schema, undefined, res.components);
			}
			//TODO: only for wizard 
			//var id = ""+label + type + (Math.random() * 10000000 +1 << .1).toString(16);
			
			//cms.addComponent('new-item-wizard', {locals:schema, feature:res.feature}, schema, undefined, res.components);
			cms.makeReady(name);
		});
	});
	$("body").on("keydown", "#component-search", function(e){
		if(e.keyCode != 13){
			return;
		}
		$("#loading").show();
		var val = $(this).val();
		var name = $("#component-search").attr('cms-name');
		cms.fetch(name + '/search/' + val, function(res){
			$("#loading").hide();
			var schema = res.schema;
			cms.clearComponents();
			cms.addComponents(res,name);
			cms.addComponent('new-item', null, schema, undefined, res.components);
			//TODO: only for wizard 
			//var id = ""+label + type + (Math.random() * 10000000 +1 << .1).toString(16);
			
			//cms.addComponent('new-item-wizard', {locals:schema, feature:res.feature}, schema, undefined, res.components);
			cms.makeReady(name);
		});
	});
	$("#cms-item-add").live('click',function(e){
		$("#loading").show();
		var feature = $(this).attr('cms-feature');
		cms.addNew(feature, $(this), "add", function(err, res){
			$("#loading").hide();
			$('.menu-selected').trigger('click');
			$("#new-item-modal").modal('hide');
		});
	});
	$(".cms-remove").live('click',function(){
		$("#loading").show();
		var self = $(this),
		feature = self.attr('cms-feature'),
		id = self.attr('cms-id');
		
		if(confirm("Are you sure you want to remove this")){
			cms.remove(feature,id);
			var elem = $(this).parentsUntil('.accordion-group').parent().parent()[0];	
			$(elem).slideUp(function(){
				$("#loading").hide();
				$(this).remove();
			});
		}
	});
	$(".cms-update").live('click',function(){
		$("#loading").show();
		var self = $(this).parentsUntil('.accordion-group').parent().parent()[0];
		var feature = $(this).attr('cms-feature');
		cms.addNew(feature, $(this), "update", function(err, res){
			$("#loading").hide();
			var data = JSON.parse(res);
			var doc = data.docs;
			var dom = cms.renderComponent('item', {id:feature + "_" + doc._id , _id:doc._id, feature:feature,}, data.schema, doc);
			$(self).replaceWith(dom);
			$(dom).find('.accordion-toggle').trigger('click');
		});
	});
	$('.thumbnail-remove').live('click', function(){
		var self = $(this);
		var doc = self.parentsUntil('.cms-document').parent()[0];
		doc = $(doc);
		var doc_id = doc.attr('data-id');
		var feature = doc.attr('data-feature');
		var img = self.attr('data-name');
		var label = self.attr('data-label');
		if(confirm('This image will be removed!')){
			$("#loading").show();
			$.post('/cms/remove-image',{feature:feature, document:doc_id, image:img, label:label}, function(res){
				$("#loading").hide();
				self.parent().slideUp();
			});
		}
	});
	$("body").on("change", "input[cms-type=images],input[cms-type=image]", function(e){
		var files = this.files;
		var input = $(this);
		if(input.attr("cms-crop") == "false"){
			return;
		}
		$("#image_crop_pics").html('');
		for(var i=0; i<files.length; i++){
			 var anyWindow = window.URL || window.webkitURL;
			 $("#image_crop_pics").append("<img data-name='"+(files[i].name ||files[i].fileName) +"' src='"+anyWindow.createObjectURL(files[i])+"' />");
		}
		//crop box size
		var crop_size = [];
		crop_size.push(60);
		crop_size.push(70);
		var crop_sizes = input.attr("cms-crop-ratio");
		
		crop_sizes = crop_sizes ? JSON.parse(crop_sizes) : void 0;
		if(crop_sizes){
			crop_size.push((crop_sizes[1] / 2) << .1);
			crop_size.push((crop_sizes[0]/2) << .1);
		}else{
			crop_size.push(300);		
			crop_size.push(300);		
		}
		var aspect_ratio = input.attr("cms-maintain-ratio");
		if(crop_sizes){
			aspect_ratio = crop_sizes[1]/crop_sizes[0];
		}else{
			aspect_ratio = aspect_ratio ? 1 : 0;
		}
		$("#image_crop_pics img").each(function(){
			var obj = {};
			obj.el = $(this);
			obj.input = input;
			$(this).Jcrop({
				bgFade:     true,
				bgOpacity: .2,
				setSelect: crop_size,
				aspectRatio: aspect_ratio
			}, function(){
				obj.crop =  this;
			});
			crops.push(obj);
		});
		$("#imageCropModal").modal('show');
	});
	$("body").on("click", "#componentsblock div", function(){
		var self = $(this);
		var template = self.attr("data-template");
		var options = JSON.parse(self.attr("data-options"));
		var schema = JSON.parse(self.attr("data-schema"));
		var data = JSON.parse(self.attr("data-data"));
		//var components = JSON.parse(self.attr("data-components"));
		var html = cms.renderComponent(template, options, schema, data);
				
		$("#__componentblockmodal_content").html('').append(html);
		html.find('.accordion-body').removeClass('collapse').css('height', 'auto');
		$("#__componentblockmodal").modal('show');

		
	});
	//custom
	
	$("body").on('click', '.slider-pic img', function(){
		$("#slider-pic-display").attr('src',$(this).attr('src'));
		$("#slider-pic-file").attr('cms-name', $(this).attr('cms-field'));
		$("#slider-pic-set").attr('cms-id', $(this).attr('cms-id'));
		var html = [
			'<input type="text" value="'+($(this).attr('data-heading') || '')+'" cms-name="'+$(this).attr('cms-field')+'_heading" cms-type="string" placeholder="heading">',
			'<input type="text" value="'+($(this).attr('data-details') || '')+'" cms-name="'+$(this).attr('cms-field')+'_details" cms-type="string" placeholder="description">',
			'<input type="text" value="'+($(this).attr('data-url') || '')+'" cms-name="'+$(this).attr('cms-field')+'_url" cms-type="string" placeholder="url">',
			'<input type="text" value="'+($(this).attr('data-url_label') || '')+'" cms-name="'+$(this).attr('cms-field')+'_url_label" cms-type="string" placeholder="url label">'
		];
		$("#slider-pic-information").html(html.join(''));
	});
	$("body").on('click', '.featured-pic img', function(){
		//set id if not set, means this is the first time this field is filled
		var id = $(this).attr('cms-id');
	});	
	$("#slider-pic-set").click(function(){
		var self = $(this);
		var id = $(this).attr('cms-id');
		var field = $(this).attr('cms-field');
		$("#loading").show();
		cms.addNew('homepage_slides', $(this), "update", function(err, res){
			$("#loading").hide();
			var data = JSON.parse(res);
			var doc = data.docs;
			$("#carouselModal").modal('hide');
		});
		
	});
	
	$("#featured-product-search").on("keyup", function(e){
		if(e.keyCode != 13) return;
		var val = $(this).val();
		$("#loading").show();
		$.getJSON("/cms/products/" + val, function(products){
			$("#loading").hide();
			$("#featured-product-display").html("");
			products.forEach(function(prod){
				$("#featured-product-display").append(jade.render('featured-product-display', prod));
			});
		});
	});
	$("body").on("click", ".featured-pic img", function(){
		var field = $(this).attr('cms-field');
		$("#featured-product-search").attr('cms-field', field);
	});
	$("body").on('click', '.featured-product-set', function(){
		var field = $("#featured-product-search").attr('cms-field');
		var prod_id = $(this).attr('data-id');
		var form = new FormData();
		form.append(field, prod_id);
		cms.makeRequest('homepage_featured_products', 'update', form);
		$("#featuredModal").modal('hide');
	});
	$("#popular-product-search").on("keyup", function(e){
		if(e.keyCode != 13) return;
		var val = $(this).val();
		$("#loading").show();
		$.getJSON("/cms/products/" + val, function(products){
			$("#loading").hide();
			$("#popular-product-display").html("");
			products.forEach(function(prod){
				$("#popular-product-display").append(jade.render('popular-product-display', prod));
			});
		});
	});
	$("body").on("click", ".popular-pic img", function(){
		var field = $(this).attr('cms-field');
		$("#popular-product-search").attr('cms-field', field);
	});
	$("body").on('click', '.popular-product-set', function(){
		var field = $("#popular-product-search").attr('cms-field');
		var prod_id = $(this).attr('data-id');
		var form = new FormData();
		form.append(field, prod_id);
		cms.makeRequest('homepage_popular_products', 'update', form);
		$("#popularModal").modal('hide');
	});
	$("#updatepassword").click(function(){
		var newpass = $("#newpassword_newpass").val();
		var conf = $("#newpassword_confirm").val();
		if(newpass != conf){
			return alert("password doesn't match");
		}
		$.post('/cms/users/update/password',{password:newpass}, function(res){
			if(res.error){
				alert(res.error);
			}else{
				window.location.reload(true);
			}
		});
	});
	$("body").on("click",".cms-table-column-add", function(){
		var table = $(this).parent().parent().find("table");
		var headrow = table.find("thead tr");
		headrow.append("<th contenteditable='true' style='font-weight:bold'>&nbsp;</th>");
		//add a column to each row
		
		var rows = table.find("tbody tr");
		if(rows.length){
			console.log(rows);
			rows.each(function(row){
				$(this).append("<td contenteditable='true'>&nbsp;</td>");
			});
		}
	});
	$("body").on("click",".cms-table-row-add", function(){
		var table = $(this).parent().parent().find("table");
		var rows = table.find("tbody");
		//count columns
		var length = table.find("thead tr th").length;
		var new_row = [];
		for(var i=0;i<length; i++){
			new_row.push("<td contenteditable='true'>&nbsp;</td>");
		}
		new_row.join("");
		rows.append("<tr>" + new_row + "</tr>");
	});
	$("body").on("click",".cms-table-column-remove", function(){
		var table = $(this).parent().parent().find("table");
		var headrow = table.find("thead tr");
		//remove last th
		headrow.find("th:last").remove();
		//remove last td of all rows
		
		var rows = table.find("tbody tr");
		rows.find("td:last").remove();
	});
	$("body").on("click",".cms-table-row-remove", function(){
		var table = $(this).parent().parent().find("table");
		table.find("tbody tr:last").remove();
	});
});

var cms = {
	settings:{
		components:"#components",
		componentsblock:"#componentsblock",
		dom_types:{
			select:'<select />',
			image:'<input type="file" />',
			images:'<input type="file" multiple="multiple" />',
			file:'<input type="file" />',
			string:'<input type="text" />',
			number:'<input type="number" />',
			boolean:'<div class="switch" data-on-label="<i class=\'icon-ok icon-white\'></i>" data-off-label="<i class=\'icon-remove\'></i>">    <input type="checkbox"></div>',
			table:'<div />',
			component:'<div />',
			timestamp:'<input type="text" />',
			string_thaana:'<textarea class="thaana thaana-textarea"></textarea>',
			string_thaana_textbox:'<input class="thaana" type="text">'
		}
	},
	fetch:function fetch(feature, callback){
		if(this.xhr)
			this.xhr.abort();
		this.xhr = $.getJSON("/cms/" + feature, callback);
	},
	renderComponent:function renderComponent(template, options, schema, data, components){
		var dom = $(jade.render(template, options || {}));
		for(var i in schema){
			var d = schema[i].type == 'component' ? components : void 0;
			var field = typeof data === 'undefined' ? cms.renderField(i,schema[i], d): cms.renderField(i,schema[i], data[i]);
			dom.find('.cms-elems').append(field);
		}
		return dom;
	},
	addComponent:function addComponent(template, options, schema, data, components, statics){
		var html = cms.renderComponent(template, options, schema, data, components);
		html = $(html);
		if(statics && statics.readonly){
			html.find(".form-actions").remove();
		}
		
		if(statics && statics.view && statics.view.type == 'block'){
			html.hide();
			var attrs = [
				"data-template='"+ template +"'",
				"data-options='"+ JSON.stringify(options) +"'",
				"data-schema='"+ JSON.stringify(schema) +"'",
				"data-data='"+ JSON.stringify(data) +"'",
				"data-components='"+ JSON.stringify(components) +"'",
			];
			$(cms.settings.componentsblock).append("<div "+attrs.join(" ")+" style='cursor:pointer;text-align: center;border: solid 1px #c0c0c0;padding-bottom: 25px;border-radius: 3px;margin-bottom:25px' class='span3'><h5>"+data.name+"</h5><img style='width:170px' src='/files/medium_"+data.gallery[0]+"' /></div>");
		}else{
			$(cms.settings.components).append(html);
		}
	},
	addComponents:function addComponents(components,feature){
		_.each(components.docs,function(e,i){
			cms.addComponent('item',{name:e.name,id:feature + "_" + e._id,_id:e._id,feature:feature},components.schema,e,components.components, components.statics);
		});
		if(components.docs.length == 1){
			$(cms.settings.components).find('.accordion-body').removeClass('collapse').css('height', 'auto');
		}
	},
	generateFieldDom:function(schema){
		var type = schema.type;
		var dom;
		if(type == 'string' && schema.multi){
			dom = '<textarea></textarea>';
		}
		else{
			dom = cms.settings.dom_types[schema.type]
		}
		return $(dom);
	},
	clearComponents:function clearComponents(){
		$(cms.settings.components).html('');
		$(cms.settings.componentsblock).html('');
	},
	renderField:function(label,schema, data){
		var type = schema.type;
		var dom = this.generateFieldDom(schema);
		dom.attr('cms-name',label);
		dom.attr('cms-type',type);
		var extra = [];
		switch(type){
			case "number":
				dom.attr('value',data);
				dom.attr('placeholder',schema.placeholder);
				break;
				
			case "string":
				dom.attr('value',data);
				dom.attr('placeholder',schema.placeholder);
				if(schema.autocomplete == true){
					dom.attr('data-provide', "typeahead");
					dom.attr('data-items', "4");
					var autocompletedata = [];
					var field = schema.source.split('.')[1];
					for(var i=0; i<schema.data.length; i++){
						autocompletedata.push(schema.data[i][field]);
					}
					dom.attr('data-source', JSON.stringify(autocompletedata));					
				}
				dom.html(data);
				break;
			case "timestamp":
				dom.attr('value',data);
				break;
			case "select":
				//dom.attr('value',data);
				var field = schema.source.split('.')[1];
				console.log(data);
				for(var i=0; i<schema.data.length; i++){
					var select = data && schema.data[i]['_id'] == data.id ? " selected " : " ";
					dom.append("<option "+select+" value='"+schema.data[i]['_id']+":"+schema.data[i][field]+"'>" + schema.data[i][field] + "</option>");
				}
				break;
			case "boolean":
				if(data == true){
					dom.find("input").attr("checked", "checked");
				}
				dom.bootstrapSwitch();
				break;
			case "table":
				var _btns = [
					"<div class='btn-group'><button class='btn cms-table-column-add' type='button'>+ Column</button><button class='btn cms-table-column-remove' type='button'>- Column</button></div>",
					"<div class='btn-group'><button class='btn cms-table-row-add' type='button'>+ Row</button><button class='btn cms-table-row-remove' type='button'>- Row</button></div>"
				].join("");
				var btns = $(_btns);
				var table = '<table data-schema="'+encodeURIComponent(JSON.stringify(schema))+'"><thead><tr></tr></head><tbody></tbody></table>';
				table = $(table);
				table.addClass("table");
				table.addClass("table-bordered");
				if(data){
					var headers = table.find("thead tr");
					var rows = table.find("tbody");
					var column_count = data.columns.length;
					var editable = schema.readonly == true ? "false" : "true";
					//append columns
					_.each(data.columns, function(column){
						headers.append("<th contenteditable='"+editable+"'>"+column+"</th>");
					});
					
					//append rows
					_.each(data.rows, function(row){
						var r = _.map(row, function(cell){
							return "<td contenteditable='"+editable+"'>"+cell+"</td>";
						}).join('');
						rows.append("<tr>"+r+"</tr>");
					});
				}
				if(schema.readonly == false || !schema.readonly){
					dom.append(btns);
				}
				dom.append(table);
				
				break;
			case "string_thaana":
				dom.thaana();
				dom.html(data);
				break;
			case "string_thaana_textbox":
				dom.thaana();
				dom.val(data);
				break;
			case "image":
				if(data)
					extra.push(jade.render('image-thumbs',{image:data}));
				if(schema.manualcrop == false){
					dom.attr("cms-crop", "false");
				}
				if(schema.maintain_ratio == false){
					dom.attr("cms-maintain-ratio", "false");
				}
				if(schema.crop_height && schema.crop_width){
					dom.attr("cms-crop-ratio", "["+schema.crop_height+","+schema.crop_width+"]");
				}
				
				break;
			case "images":
				if(data)
					extra.push(jade.render('image-thumbs',{image:data, label:label}));
				if(schema.manualcrop == false){
					dom.attr("cms-crop", "false");
				}
				if(schema.maintain_ratio == false){
					dom.attr("cms-maintain-ratio", "false");
				}
				if(schema.crop_height && schema.crop_width){
					dom.attr("cms-crop-ratio", "["+schema.crop_height+","+schema.crop_width+"]");
				}
				break;
			case "component":
				dom.append(jade.render('components',{components:data}));
				break;
		}
		//var html = '<div class="control-group"><label class="control-label">'+ label +'</label><div class="controls">'+ dom[0].outerHTML + extra.join('') +'</div></div>';
		var html = $('<div class="control-group"><label class="control-label" style="text-transform:capitalize">'+ label.split("_").join(" ") +'</label><div class="controls"></div></div>');
		html.find('.controls').append(dom);
		html.find('.controls').append(extra.join(''));
		
		//wyswyg
		if(schema.rtl){
			html.attr('cms-name',label);
			html.attr('cms-type',type);			
			//append random id to it
			var id = ""+label + type + (Math.random() * 10000000 +1 << .1).toString(16)
			html.attr('cms-type-rtl',id);
			html.find('textarea').attr('id', id).wysihtml5({
				"font-styles": true,
				"emphasis": true, 
				"lists": true, 
				"html": false, 
				"link": false, 
				"image": false,
				"color": false
			});
		}
		return html;
	},
	makeReady:function(name){
		//set cms-name of 'Add new item' to the feature
		$("#cms-item-add").attr("cms-feature",name);
	},
	getFiles:function(el){
		var form = new FormData();
		var files = el.parent().parent().parent().find("input[type='file']");
		_.each(files,function(filelist){
			var file = filelist.files;
			for(var i = 0; i < file.length; i++)
				form.append(file[i].fileName || file[i].name,file[i]);

		});
		return form;
	},
	makeRequest:function(feature,action,form, callback){
		var xhr = new XMLHttpRequest();
		xhr.open("POST", "/cms/"+ feature +"/" + action, true);
		xhr.send(form);
		
		xhr.addEventListener('readystatechange',function(){
			if(xhr.readyState == 4){
				if(callback){
					callback(null, xhr.response);
				}
			}
		});
	},
	addNew:function(feature,el,type, callback){
		var form = cms.getFiles(el);
		var els = el.parent().parent().parent().find("[cms-name]");
		
		//set crops
		crops.forEach(function(obj){
			var cropped = obj.input.attr('cms-crop');
			if(cropped){
				cropped = JSON.parse(cropped);
			}else{
				cropped = {};
			}
			cropped[obj.el.attr('data-name')] = obj.crop.tellSelect();
			obj.input.attr('cms-crop', JSON.stringify(cropped));
		});
		_.each(els,function(e){
			var elem = $(e)
				, type = elem.attr('cms-type')
				, name = elem.attr('cms-name');
			if(type == "string"){
				//check for rte
				var rte = elem.attr('cms-type-rtl');
				var val;
				if(rte){
					val = $("#" + rte).val();
				}else{
					val = elem.val();
				}
				form.append(name, elem.val());
			}
			if(type == "number"){
				//check for rte
				var rte = elem.attr('cms-type-rtl');
				var val;
				if(rte){
					val = $("#" + rte).val();
				}else{
					val = elem.val();
				}
				form.append(name, elem.val());
			}
				
			if(type == "timestamp")
				form.append(name, elem.val())
				
			if(type == "select"){
				var select = elem.val().split(":");
				var select_name = select[1];
				var select_val = select[0]
				form.append(name, JSON.stringify({id:select_val, name:select_name}));
			}
				
			if(type == "boolean"){
				form.append(name, elem.bootstrapSwitch('status'))
			}
			if(type == "table"){
				var columns = elem.find("thead tr th")
				columns = _.map(columns, function(column){
					return $(column).text();
				});
				var rows = elem.find("tbody tr")
				rows = _.map(rows, function(row){
					return _.map($(row).children(),function(elem){
						return $(elem).text();
					});
				});
				var data = {
					columns:columns,
					rows:rows
				};
				
				data = JSON.stringify(data);
				form.append(name, data);
			} 
			if(type == "string_thaana")
				form.append(name, elem.is(":checked"))
				
			if(type == "string_thaana_textbox")
				form.append(name, elem.val())
			
			if(type == 'image'){
				if(elem[0].files.length > 0){
					form.append(name, elem[0].files[0].fileName || elem[0].files[0].name);
					if(elem.attr('cms-crop')){
						form.append(name+"-crop", elem.attr('cms-crop'));
					}
				}
			}
			if(type == 'file'){
				if(elem[0].files.length > 0){
					form.append(name, elem[0].files[0].fileName || elem[0].files[0].name);
				}
			}
			if(type == 'images'){
		
				if(elem[0].files.length > 0){
					form.append(name, elem[0].files[0].fileName || elem[0].files[0].name);
					if(elem.attr('cms-crop')){
						form.append(name+"-crop", elem.attr('cms-crop'));
					}
				}
			}
			
			
		});
		if(type == 'update'){
			form.append('id', el.attr('cms-id'));
		}
		cms.makeRequest(feature,type,form, callback);
	},
	remove:function(feature,id){
		$.post('/cms/remove-component', {feature:feature,id:id}, function(res){
			
		});
	}
}

