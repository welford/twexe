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

var target_file_field = "twexe_target";
var button_name_field = "twexe_title";

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
		var clipboard = document.createElement("button");
		var open_tiddler = document.createElement("button");

		explorer.innerHTML = "Open in Explorer";
		clipboard.innerHTML = "Copy Path to clipboard";
		open_tiddler.innerHTML = "Open Defining Tiddler";

		context_menu.appendChild(explorer);
		context_menu.appendChild(document.createElement("br"));
		context_menu.appendChild(clipboard);
		context_menu.appendChild(document.createElement("br"));
		context_menu.appendChild(open_tiddler);
		
		context_menu.style.display = "None";
		context_menu.style.zIndex = "1000";
		context_menu.style.position = "absolute";

		TWExeWidget.context_menu = context_menu;
		TWExeWidget.explorer = explorer;
		TWExeWidget.clipboard = clipboard;
		TWExeWidget.open_tiddler = open_tiddler;

		document.body.appendChild(TWExeWidget.context_menu)

		//close the context menu on any other click
		document.onmousedown = function (event) {
			if (event.target == TWExeWidget.clipboard || event.target == TWExeWidget.explorer || event.target == TWExeWidget.open_tiddler) {
				event.target.click();
			}
			TWExeWidget.context_menu.style.display = "None";
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
TWExeWidget.context_menu = null;
TWExeWidget.explorer = null;
TWExeWidget.clipboard = null;
TWExeWidget.open_tiddler = null;


TWExeWidget.prototype.GetLatestDetails = function ()
{
	this.target = "undefined";
	this.name = "undefined";
	this.comment = "undefined";

	this.src_tiddler = this.getAttribute("tiddler", this.getVariable("currentTiddler"));//if missing then use the current tiddler...
	//if (!this.src_tiddler) {						//...which is done here
	//	this.src_tiddler = this.getVariable("storyTiddler");
	//}

	//get defaults for things that are not set
	source_tid = this.wiki.getTiddler(this.src_tiddler);
	if (source_tid) {
		//set button target if not set already
		if (source_tid.hasField(target_file_field)) {
			this.target = source_tid.fields[target_file_field];
		}
		//set button title if not set already
		if (source_tid.hasField(button_name_field)) {
			this.name = source_tid.fields[button_name_field];
		} else {
			this.name = this.src_tiddler;
		}
		//comments too
		var comment = this.wiki.getTiddlerText(this.src_tiddler);
		if (comment) {
			this.comment = comment;
		} else {
			this.comment = " ";
		}
	}	

	this.isFolder = false;
	var path = this.target.split("/").join("\\");
	var FSO = new ActiveXObject("Scripting.FileSystemObject");		
	if (FSO.FolderExists(path)) {
		this.isFolder = true;
	}
}

/*
Render this widget into the DOM
*/
TWExeWidget.prototype.render = function (parent, nextSibling) {
	// Remember parent
	this.parentDomNode = parent;
	// Compute attributes and execute state
	this.computeAttributes();
	this.execute();

	var self = this;

	// Create element
	var button = this.document.createElement("button");
	// Assign classes
	var classes = this["class"].split(" ") || [];	
	button.className = classes.join(" ");
	// Assign styles
	if(this.style) {
		button.setAttribute("style", this.style);
	}
	//set the button name
	button.innerHTML = (this.isFolder ? "Folder: " : "") + this.name;
	//set hover comment
	button.setAttribute("title", this.comment);
	//add the target to be called to the title
	if (self.target) {
		var tmp = button.getAttribute("title")
		button.setAttribute( "title", (tmp? tmp : "") + "\n calls : " + self.target.split("\\").join("/") );
	}
	// Add a click event handler
	button.addEventListener("click", function (event) {		
		if (self.target) {			
			self.GetLatestDetails(); //update details
			self.runFile(event);
			event.preventDefault();
			event.stopPropagation();
			return true;
		}
		return false;
	}, false);

	button.oncontextmenu = function (event) {
		//display the context menu in the correct place
		TWExeWidget.context_menu.style.display = "block";
		TWExeWidget.context_menu.style.top = mouseY(event) + "px";
		TWExeWidget.context_menu.style.left = mouseX(event) + "px";

		//clone the elements to rid us of the old event listeners
		var old_element = TWExeWidget.explorer;
		var new_element = old_element.cloneNode(true);
		old_element.parentNode.replaceChild(new_element, old_element);
		TWExeWidget.explorer = new_element;

		var old_element = TWExeWidget.clipboard;
		var new_element = old_element.cloneNode(true);
		old_element.parentNode.replaceChild(new_element, old_element);
		TWExeWidget.clipboard = new_element;

		var old_element = TWExeWidget.open_tiddler;
		var new_element = old_element.cloneNode(true);
		old_element.parentNode.replaceChild(new_element, old_element);
		TWExeWidget.open_tiddler = new_element;
		//if this isn't based on a source tiddler don't display it
		if (self.src_tiddler) {
			TWExeWidget.open_tiddler.style.display = "block";
		}
		else {			
			TWExeWidget.open_tiddler.style.display = "None";
		}

		//add custom click events to the context buttons
		TWExeWidget.explorer.addEventListener("click", function (event) {
			self.GetLatestDetails(); //update details
			self.openFile(event);			
			event.preventDefault();
			event.stopPropagation();
			return true;			
		}
		,false);

		TWExeWidget.clipboard.addEventListener("click", function (event) {
			self.GetLatestDetails(); //update details
			self.copyToClip(event);
			event.preventDefault();
			event.stopPropagation();
			return true;
		}
		, false);

		TWExeWidget.open_tiddler.addEventListener("click", function (event) {
			self.GetLatestDetails(); //update details
			self.OpenDefiningTiddler(event);
			event.preventDefault();
			event.stopPropagation();
			return true;			
		}
		, false);

		return false;
	}

	// Insert element	
	parent.insertBefore(button, nextSibling);

	this.renderChildren(button, null);
	this.domNodes.push(button);
};

TWExeWidget.prototype.runFile = function (event) {
	if (this.target) {
		var path = this.target.split("/").join("\\");
		if (this.isFolder){
			this.openFile(event);
		}
		else {
			var WshShell = new ActiveXObject("WScript.Shell");
			WshShell.Run("cmd /c " + path )
		}
	} else {
		alert("file parameter incorrectly set")
	}
};

TWExeWidget.prototype.openFile = function (event) {
	if (this.target) {
		var path = this.target.split("/").join("\\");
		if (this.isFolder)
		{
			var WshShell = new ActiveXObject("WScript.Shell");
			WshShell.Run("explorer /e, " + path);		
		} else {
			var WshShell = new ActiveXObject("WScript.Shell");
			WshShell.Run("explorer /select, " + path );
		}		
	}
	else {
		alert("file parameter incorrectly set")
	}
};

TWExeWidget.prototype.copyToClip = function (event) {
	if (this.target) {
		window.clipboardData.setData( "Text", this.target.split("\\").join("/") );
		window.clipboardData.getData( "Text" );  // To copy from clipboard
	}
	else {
		alert("file parameter not set")
	}
};

TWExeWidget.prototype.OpenDefiningTiddler = function (event) {
	
	var bounds = this.domNodes[0].getBoundingClientRect();
	this.dispatchEvent({
		type: "tw-navigate",
		navigateTo: this.src_tiddler,
		navigateFromTitle: this.getVariable("storyTiddler"),
		navigateFromNode: this,
		navigateFromClientRect: {
			top: bounds.top, left: bounds.left, width: bounds.width, right: bounds.right, bottom: bounds.bottom, height: bounds.height
		},
		navigateSuppressNavigation: event.metaKey || event.ctrlKey || (event.button === 1)
	});
};

/*
Compute the internal state of the widget
*/
TWExeWidget.prototype.execute = function () {
	this.GetLatestDetails();

	//other genral attributes
	this["class"] = this.getAttribute("class", "");
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
	if (changedAttributes["class"] || changedAttributes.selectedClass || changedAttributes.style || changedAttributes.src_tiddler) {
		this.refreshSelf();
		return true;
	}
	return this.refreshChildren(changedTiddlers);
};

exports.twexe = TWExeWidget;

})();
