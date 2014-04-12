/*\
title: $:/plugins/welford/twexe/twdropzone.js
type: application/javascript
module-type: widget

Custom Dropzone widget, creates TWEXE tiddlers when files are dropped here

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var Widget = require("$:/core/modules/widgets/widget.js").widget;

var TWDropZoneWidget = function(parseTreeNode,options) {
	this.initialise(parseTreeNode,options);
};

/*
Inherit from the base widget class
*/
TWDropZoneWidget.prototype = new Widget();

/*
Render this widget into the DOM
*/
TWDropZoneWidget.prototype.render = function (parent, nextSibling) {
	var self = this;
	// Remember parent
	this.parentDomNode = parent;
	// Compute attributes and execute state
	this.computeAttributes();
	this.execute();
	// Create element
	var domNode = this.document.createElement("div");
	domNode.className = "tw-dropzone";
	// Add event handlers
	$tw.utils.addEventListeners(domNode,[
		{name: "dragenter", handlerObject: this, handlerMethod: "handleDragEnterEvent"},
		{name: "dragover", handlerObject: this, handlerMethod: "handleDragOverEvent"},
		{name: "dragleave", handlerObject: this, handlerMethod: "handleDragLeaveEvent"},
		{name: "drop", handlerObject: this, handlerMethod: "handleDropEvent"},
		{name: "paste", handlerObject: this, handlerMethod: "handlePasteEvent"}
	]);
	domNode.addEventListener("click",function (event) {
	},false);
	// Insert element
	parent.insertBefore(domNode,nextSibling);
	this.renderChildren(domNode,null);
	this.domNodes.push(domNode);
};

TWDropZoneWidget.prototype.handleDragEnterEvent = function (event) {
	// We count enter/leave events
	this.dragEnterCount = (this.dragEnterCount || 0) + 1;
	// If we're entering for the first time we need to apply highlighting
	if(this.dragEnterCount === 1) {
		$tw.utils.addClass(this.domNodes[0],"tw-dragover");
	}
	// Tell the browser that we're ready to handle the drop
	event.preventDefault();
	// Tell the browser not to ripple the drag up to any parent drop handlers
	event.stopPropagation();
};

TWDropZoneWidget.prototype.handleDragOverEvent = function (event) {
	// Tell the browser that we're still interested in the drop
	event.preventDefault();
	event.dataTransfer.dropEffect = "copy"; // Explicitly show this is a copy
};

TWDropZoneWidget.prototype.handleDragLeaveEvent = function (event) {
	// Reduce the enter count
	this.dragEnterCount = (this.dragEnterCount || 0) - 1;
	// Remove highlighting if we're leaving externally
	if(this.dragEnterCount <= 0) {
		$tw.utils.removeClass(this.domNodes[0],"tw-dragover");
	}
};

TWDropZoneWidget.prototype.handleDropEvent = function (event) {
	var self = this,
		dataTransfer = event.dataTransfer;
	// Reset the enter count
	this.dragEnterCount = 0;
	// Remove highlighting
	$tw.utils.removeClass(this.domNodes[0],"tw-dragover");
	// Import any files in the drop
	var numFiles = this.wiki.readFiles(dataTransfer.files,function(tiddlerFieldsArray) {
		self.dispatchEvent({type: "tw-import-tiddlers", param: JSON.stringify(tiddlerFieldsArray)});
	});
	// Try to import the various data types we understand
	if(numFiles === 0) {
		this.importData(dataTransfer);
	}
	// Tell the browser that we handled the drop
	event.preventDefault();
	// Stop the drop ripple up to any parent handlers
	event.stopPropagation();
};

TWDropZoneWidget.prototype.importData = function (dataTransfer) {
	// Try each provided data type in turn
	for(var t=0; t<this.importDataTypes.length; t++) {
		if(!$tw.browser.isIE || this.importDataTypes[t].IECompatible) {
			// Get the data
			var dataType = this.importDataTypes[t];
				var data = dataTransfer.getData(dataType.type);
			// Import the tiddlers in the data
			if(data !== "" && data !== null) {
				var tiddlerFields = dataType.convertToFields(data);
				if(!tiddlerFields.title) {
					tiddlerFields.title = this.wiki.generateNewTitle("Untitled");
				}
				this.dispatchEvent({type: "tw-import-tiddlers", param: JSON.stringify([tiddlerFields])});
				return;
			}
		}
	};
};

TWDropZoneWidget.prototype.importDataTypes = [
	{type: "text/vnd.tiddler", IECompatible: false, convertToFields: function(data) {
		return JSON.parse(data);
	}},
	{type: "URL", IECompatible: true, convertToFields: function(data) {
		// Check for tiddler data URI
		var match = decodeURI(data).match(/^data\:text\/vnd\.tiddler,(.*)/i);
		if(match) {
			return JSON.parse(match[1]);
		} else {
			return { // As URL string
				text: data
			};
		}
	}},
	{type: "text/x-moz-url", IECompatible: false, convertToFields: function(data) {
		// Check for tiddler data URI
		var match = decodeURI(data).match(/^data\:text\/vnd\.tiddler,(.*)/i);
		if(match) {
			return JSON.parse(match[1]);
		} else {
			return { // As URL string
				text: data
			};
		}
	}},
	{type: "text/html", IECompatible: false, convertToFields: function(data) {
		return {
			text: data
		};
	}},
	{type: "text/plain", IECompatible: false, convertToFields: function(data) {
		return {
			text: data
		};
	}},
	{type: "Text", IECompatible: true, convertToFields: function(data) {
		return {
			text: data
		};
	}},
	{type: "text/uri-list", IECompatible: false, convertToFields: function(data) {
		return {
			text: data
		};
	}}
];

TWDropZoneWidget.prototype.handlePasteEvent = function (event) {
	// Let the browser handle it if we're in a textarea or input box
	if(["TEXTAREA","INPUT"].indexOf(event.target.tagName) == -1) {
		var self = this,
			items = event.clipboardData.items;
		// Enumerate the clipboard items
		for(var t = 0; t<items.length; t++) {
			var item = items[t];
			if(item.kind === "file") {
				// Import any files
				this.wiki.readFile(item.getAsFile(),function(tiddlerFieldsArray) {
					self.dispatchEvent({type: "tw-import-tiddlers", param: JSON.stringify(tiddlerFieldsArray)});
				});
			} else if(item.kind === "string") {
				// Create tiddlers from string items
				item.getAsString(function(str) {
					var tiddlerFields = {
						title: self.wiki.generateNewTitle("Untitled"),
						text: str
					};
					self.dispatchEvent({type: "tw-import-tiddlers", param: JSON.stringify([tiddlerFields])});
				});
			}
		}
		// Tell the browser that we've handled the paste
		event.stopPropagation();
		event.preventDefault();
	}
};

/*
Compute the internal state of the widget
*/
TWDropZoneWidget.prototype.execute = function () {
	// Make child widgets
	this.makeChildWidgets();
};

/*
Selectively refreshes the widget if needed. Returns true if the widget or any of its children needed re-rendering
*/
TWDropZoneWidget.prototype.refresh = function (changedTiddlers) {
	return this.refreshChildren(changedTiddlers);
};

exports.twdropzone = TWDropZoneWidget;

})();
