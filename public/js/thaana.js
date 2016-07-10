(function($){
$.fn.thaana = function(arg){
	var map = {h:"ހ",S:"ށ",n:"ނ",r:"ރ",b:"ބ",L:"ޅ",k:"ކ",w:"އ",v:"ވ",m:"މ",f:"ފ",d:"ދ",t:"ތ",l:"ލ",g:"ގ",N:"ޏ",s:"ސ",D:"ޑ",z:"ޒ",T:"ޓ",y:"ޔ",p:"ޕ",j:"ޖ",c:"ޗ",a:"ަ",A:"ާ",i:"ި",I:"ީ",u:"ު",U:"ޫ",o:"ޮ",O:"ޯ",e:"ެ",E:"ޭ",q:"ް",X:"ޘ",H:"ޙ",K:"ޚ",J:"ޛ",R:"ޜ",C:"ޝ",B:"ޞ",M:"ޟ",Y:"ޠ",Z:"ޡ",W:"ޢ",G:"ޣ",Q:"ޤ",V:"ޥ",F:"ﷲ", _:"_", ".":".","(":")",")":"("};
	var self, type, iframeWin, iframe;
	var iframe = this.contents();
	if(iframe[0]){
		iframe = iframe.get(0);
		iframe.designMode = 'on';
		iframe.dir = "rtl";
		iframeWin = iframe.contentWindow || iframe.defaultView;
		self = $(iframe);
		type = "iframe";
	}else{
		self = this;
		self.css({"text-align":"right",direction:"rtl","font-weight":"normal"});
	}
	self.bind("keypress",function(evt){
		console.log(evt.keyCode);
		var val = this.value;
		evt = evt || window.event;
		// Ensure we only handle printable keys, excluding enter and space
		var charCode = typeof evt.which == "number" ? evt.which : evt.keyCode;
		if (charCode && charCode > 32) {
			var keyChar = String.fromCharCode(charCode);
			// Transform typed character
			var mappedChar = map[keyChar] || keyChar;
			if(type == "iframe"){
				iframeWin.document.execCommand("insertText", false, mappedChar);
				return false;
			}
			if(mappedChar == false){
				evt.preventDefault();
				evt.stopPropagation();
			}
			var start, end;
			if (typeof this.selectionStart == "number" && typeof this.selectionEnd == "number") {
				// Non-IE browsers and IE 9
				start = this.selectionStart;
				end = this.selectionEnd;
				this.value = val.slice(0, start) + mappedChar + val.slice(end);
				// Move the caret
				this.selectionStart = this.selectionEnd = start + 1;
			}else if (document.selection && document.selection.createRange) {
				// For IE up to version 8
				var selectionRange = document.selection.createRange();
				var textInputRange = this.createTextRange();
				var precedingRange = this.createTextRange();
				var bookmark = selectionRange.getBookmark();
				textInputRange.moveToBookmark(bookmark);
				precedingRange.setEndPoint("EndToStart", textInputRange);
				start = precedingRange.text.length;
				end = start + selectionRange.text.length;

				this.value = val.slice(0, start) + mappedChar + val.slice(end);
				start++;
				// Move the caret
				textInputRange = this.createTextRange();
				textInputRange.collapse(true);
				textInputRange.move("character", start - (this.value.slice(0, start).split("\r\n").length - 1));
				textInputRange.select();
			}
			return false;
		}
	});
}

})(jQuery)
