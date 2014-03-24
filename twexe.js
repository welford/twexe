/*\
title: $:/plugins/welford/twaexe/twexe.js
type: application/javascript
module-type: widget

twexe widget

\*/

(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
//"use strict";


function mouseX(evt) {
	if (evt.pageX) {
		return evt.pageX;
	} else if (evt.clientX) {
		return evt.clientX + (document.documentElement.scrollLeft ?
			document.documentElement.scrollLeft :
			document.body.scrollLeft);
	} else {
		return null;
	}
}

function mouseY(evt) {
	if (evt.pageY) {
		return evt.pageY;
	} else if (evt.clientY) {
		return evt.clientY + (document.documentElement.scrollTop ?
		document.documentElement.scrollTop :
		document.body.scrollTop);
	} else {
		return null;
	}
}

var Widget = require("$:/core/modules/widgets/widget.js").widget;

var TWExeWidget = function(parseTreeNode,options) {
	this.initialise(parseTreeNode, options);

	if (TWExeWidget.prototype.context_menu == null) {
		var context_menu = document.createElement("div");
		var explorer = document.createElement("button");
		var new_line = document.createElement("br");
		var clipboard = document.createElement("button");

		explorer.appendChild(document.createTextNode("Open in Explorer"));
		clipboard.appendChild(document.createTextNode("Copy Path to clipboard"));

		context_menu.appendChild(explorer);
		context_menu.appendChild(new_line);
		context_menu.appendChild(clipboard);
		context_menu.style.display = "None";
		context_menu.style.zIndex = "1000";
		context_menu.style.position = "absolute";

		TWExeWidget.prototype.context_menu = context_menu;
		TWExeWidget.prototype.explorer = explorer;
		TWExeWidget.prototype.clipboard = clipboard;

		//close the context menu on any other click
		document.onmousedown = function (event) {
			if (event.target == TWExeWidget.prototype.clipboard || event.target == TWExeWidget.prototype.explorer) {
				event.target.click();
			}
			TWExeWidget.prototype.context_menu.style.display = "None";
		};
	}
};

/*
Inherit from the base widget class
*/
TWExeWidget.prototype = new Widget();

/*
set class variables	initally to null, we will create them when we first get the chance
*/
TWExeWidget.prototype.context_menu = null;
TWExeWidget.prototype.explorer = null;
TWExeWidget.prototype.clipboard = null;


/*
Render this widget into the DOM
*/
TWExeWidget.prototype.render = function (parent, nextSibling) {
	var self = this;
	// Remember parent
	this.parentDomNode = parent;
	// Compute attributes and execute state
	this.computeAttributes();
	this.execute();

	// Create element
	var button = this.document.createElement("button");

	// Assign classes
	var classes = this["class"].split(" ") || [];	
	button.className = classes.join(" ");

	// Assign classes
	if(this.style) {
		button.setAttribute("style", this.style);
	}

	// Add a click event handler
	button.addEventListener("click", function (event) {		
		if (self.file) {
			self.runFile(event);
			event.preventDefault();
			event.stopPropagation();
			return true;
		}
		return false;
	}, false);

	button.oncontextmenu = function (event) {
		//display the context menu in the correct place
		TWExeWidget.prototype.context_menu.style.display = "block";
		TWExeWidget.prototype.context_menu.style.top = mouseY(event) + "px";
		TWExeWidget.prototype.context_menu.style.left = mouseX(event) + "px";
		//clone the elements to rid us of the old event listeners
		var old_element = TWExeWidget.prototype.explorer;
		var new_element = old_element.cloneNode(true);
		old_element.parentNode.replaceChild(new_element, old_element);
		TWExeWidget.prototype.explorer = new_element;

		var old_element = TWExeWidget.prototype.clipboard;
		var new_element = old_element.cloneNode(true);
		old_element.parentNode.replaceChild(new_element, old_element);
		TWExeWidget.prototype.clipboard = new_element;

		//add custom click events to the context buttons
		TWExeWidget.prototype.explorer.addEventListener("click", function (event) {
			if (self.file) {
				self.openFile(event);			
				event.preventDefault();
				event.stopPropagation();
				return true;
			}
			return false;
		}
		,false);

		TWExeWidget.prototype.clipboard.addEventListener("click", function (event) {
			if (self.file) {
				self.copyToClip(event);
				event.preventDefault();
				event.stopPropagation();
				return true;
			}
			return false;
		}
		, false);

		return false;
	}

	// Insert element	
	parent.insertBefore(button, nextSibling);
	parent.appendChild(self.context_menu);

	this.renderChildren(button, null);
	this.domNodes.push(button);

};

TWExeWidget.prototype.runFile = function (event) {
	WshShell = new ActiveXObject("WScript.Shell");	
	WshShell.Run("cmd /c " + this.file);	
};

TWExeWidget.prototype.openFile = function (event) {	
	WshShell = new ActiveXObject("WScript.Shell");
	WshShell.Run("explorer /select, " + this.file);
};

TWExeWidget.prototype.copyToClip = function (event) {
	window.clipboardData.setData("Text", this.file);
	window.clipboardData.getData("Text");  // To copy from clipboard
};



/*
Compute the internal state of the widget
*/
TWExeWidget.prototype.execute = function () {
	// Get attributes	
	this.file = this.getAttribute("file");
	this["class"] = this.getAttribute("class","");
	this.style = this.getAttribute("style");
	this.selectedClass = this.getAttribute("selectedClass");
	this.defaultSetValue = this.getAttribute("default");
	// Make child widgets
	this.makeChildWidgets();	
};

/*
Selectively refreshes the widget if needed. Returns true if the widget or any of its children needed re-rendering
*/
TWExeWidget.prototype.refresh = function (changedTiddlers) {
	var changedAttributes = this.computeAttributes();
	if (changedAttributes["class"] || changedAttributes.selectedClass || changedAttributes.style ) {
		this.refreshSelf();
		return true;
	}
	return this.refreshChildren(changedTiddlers);
};

exports.twexe = TWExeWidget;

})();
