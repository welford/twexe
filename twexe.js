/*\
title: $:/plugins/welford/twexe/twexe.js
type: application/javascript
module-type: widget

twexe widget
\*/
(function(){
/*jslint node: true, browser: true */
/*global $tw: false */
//"use strict";


var g_field_prefix	= "twexe_";
//try to get these from the macro, if not try to get from tiddler via "twexe_" + fieldname
var g_target	= "target";		//batch file to run "tiddler" if it's the text in the current tiddler
var g_name		= "name";		//name of the button displayed
var g_cwd		= "cwd";		//the working directory
var g_tooltip	= "tooltip";	//tooltip when hovering

//other data we try to grab
var g_src		= "tiddler";	//the tiddler that backs this data, if this is missing use "currentTiddler"
var g_args		= "args";		//the args to pass to the batch file, if this is missing defaults to tiddler name  + "_args"
var g_tmp		= "tmpdir";		//if we are running an immediate tiddler the batch gets created here, if not in macro defaults to value in "$:/plugins/welford/twexe/tmpdir"

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
		var open_tiddler_args = document.createElement("button");

		explorer.innerHTML = "Open in Explorer";
		clipboard.innerHTML = "Copy Path to clipboard";
		open_tiddler.innerHTML = "Open Defining Tiddler";
		open_tiddler_args.innerHTML = "Open Arguments Tiddler";

		explorer.style.display = clipboard.style.display = open_tiddler.style.display = open_tiddler_args.style.display 
		= "block";
		explorer.style.width = clipboard.style.width = open_tiddler.style.width = open_tiddler_args.style.width 
		= "100%";

		context_menu.appendChild(explorer);
		context_menu.appendChild(clipboard);
		context_menu.appendChild(open_tiddler);
		context_menu.appendChild(open_tiddler_args);

		context_menu.style.display = "None";
		context_menu.style.zIndex = "1000";
		context_menu.style.position = "absolute";

		TWExeWidget.context_menu = context_menu;
		TWExeWidget.explorer = explorer;
		TWExeWidget.clipboard = clipboard;
		TWExeWidget.open_tiddler = open_tiddler;
		TWExeWidget.open_tiddler_args = open_tiddler_args;

		document.body.appendChild(TWExeWidget.context_menu)

		//close the context menu on any other click
		document.onmousedown = function (event) {
			if (event.target == TWExeWidget.clipboard || event.target == TWExeWidget.explorer || event.target == TWExeWidget.open_tiddler || event.target == TWExeWidget.open_tiddler_args) {
				event.target.click();
			}
			TWExeWidget.context_menu.style.display = "None";
		};
	}
};

//Inherit from the base widget class
TWExeWidget.prototype = new Widget();
//set class variables	initally to null, we will create them when we first get the chance
TWExeWidget.context_menu = null;
TWExeWidget.explorer = null;
TWExeWidget.clipboard = null;
TWExeWidget.open_tiddler = null;
TWExeWidget.open_tiddler_args = null;

//
TWExeWidget.prototype.GetLatestDetails = function ()
{
	//try to get from marco, is missing try to get from the 
	this.tiddler_name = this.getAttribute(g_src,this.getVariable("currentTiddler"));
	this.tiddler_args = this.getAttribute(g_args,this.wiki.getTiddlerText(this.tiddler_name+"_args"));
	this.tmpDir = this.getAttribute(g_tmp,this.wiki.getTiddlerText("$:/plugins/welford/twexe/tmpdir"));

	this.target = this.name = this.tooltip = this.cwd = null;
	this.isImmediate = false; //runs text in tiddler, rather than from file, if target is ""
	this.hasActiveX = true;
	this.isFolder = false;
	this.contents = "pause";

	//get defaults for things that are not set
	tiddler = this.wiki.getTiddler(this.tiddler_name);
	if (tiddler) {
		this.target = this.getAttribute(g_target, (tiddler.hasField(g_field_prefix + g_target) ? tiddler.fields[g_field_prefix + g_target] : ""));
		//default to tiddler name
		this.name = this.getAttribute(g_name, (tiddler.hasField(g_field_prefix + g_name) ? tiddler.fields[g_field_prefix + g_name] : this.tiddler_name));
		//default tooltip to 
		this.tooltip = this.getAttribute(g_tooltip, (tiddler.hasField(g_field_prefix + g_tooltip) ? tiddler.fields[g_field_prefix + g_tooltip] : " "));
		//default cwd to current dir
		this.cwd = this.getAttribute(g_cwd, (tiddler.hasField(g_field_prefix + g_cwd) ? tiddler.fields[g_field_prefix + g_cwd] : ".\\"));

		if(this.target.trim().length == 0){
			this.isImmediate = true;
			this.contents = this.wiki.getTiddlerText(this.tiddler_name);
		}
	}	
	//

	if (this.target != null) {
		var path = this.target.split("/").join("\\");
		try{
			var FSO = new ActiveXObject("Scripting.FileSystemObject");		
			var WshShell = new ActiveXObject("WScript.Shell");
			if (path.trim().length > 0 && FSO.FolderExists(WshShell.ExpandEnvironmentStrings(path))) {
				this.isFolder = true;		
			}
		}
		catch (err) {
			this.hasActiveX = false;
		}
	}
}

/*
Render this widget into the DOM
*/
TWExeWidget.prototype.render = function (parent,nextSibling) {
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
	if(!button.isTiddlyWikiFakeDom){
		button.setAttribute("title", this.tooptip);
	//add the target to be called to the title
		if (self.target) {
			var tmp = button.getAttribute("title")
			button.setAttribute( "title", (tmp? tmp : "") + "\
\n- - - - - - - - - - - - - - - - - - - - - - - - - - - -\
\ncalls : " + self.target.split("\\").join("/") );
		}

			// Add a click event handler
		button.addEventListener("click", function (event) {
			self.GetLatestDetails(); //update details
			if(self.isImmediate){
				self.runTiddler(event);
			}else {
				self.runFile(event);
			}
			event.preventDefault();
			event.stopPropagation();
			return true;
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
			if (self.tiddler_name) {
				TWExeWidget.open_tiddler.style.display = TWExeWidget.open_tiddler_args.style.display = "block";
			}
			else {
				TWExeWidget.open_tiddler.style.display = TWExeWidget.open_tiddler_args.style.display = "None";
			}
			//if there is no target don't attempt to open it in explorer
			if(self.target.trim().length == 0){
				TWExeWidget.explorer.style.display = TWExeWidget.clipboard.style.display ="None";
			}else{
				TWExeWidget.explorer.style.display = TWExeWidget.clipboard.style.display = "block";
			}
			//add custom click events to the context buttons
			TWExeWidget.explorer.addEventListener("click",function (event) {
				self.GetLatestDetails(); //update details
				self.openFile(event);			
				event.preventDefault();
				event.stopPropagation();
				return true;			
			},false);

			TWExeWidget.clipboard.addEventListener("click",function (event) {
				self.GetLatestDetails(); //update details
				self.copyToClip(event);
				event.preventDefault();
				event.stopPropagation();
				return true;
			}, false);

			TWExeWidget.open_tiddler.addEventListener("click",function (event) {
				self.GetLatestDetails(); //update details
				self.OpenTiddler(event,self.tiddler_name);
				event.preventDefault();
				event.stopPropagation();
				return true;			
			}, false);

			TWExeWidget.open_tiddler_args.addEventListener("click",function (event) {
				self.GetLatestDetails(); //update details
				self.OpenTiddler(event,self.tiddler_name+"_args");
				event.preventDefault();
				event.stopPropagation();
				return true;			
			}, false);

			return false;
		}
	}
    // Insert element	
	parent.insertBefore(button,nextSibling);
	//renders what was in the <$twexe> tags to the button
	this.renderChildren(button, null);
	this.domNodes.push(button);
};

TWExeWidget.prototype.runFile = function (event) {
	if (this.hasActiveX == false) { return;}
	if (this.target) {
		var path = this.target.split("/").join("\\");		
		if (this.isFolder){
			this.openFile(event);
		}
		else {
			var args = this.tiddler_args;
			if (!args){ args = "";}
			var WshShell = new ActiveXObject("WScript.Shell");
			WshShell.CurrentDirectory = WshShell.ExpandEnvironmentStrings(this.cwd);
			if(path.indexOf(".bat") > -1 || path.indexOf(".cmd") > -1){
				WshShell.Run( "cmd /c " + path + " " + args );
			}else{
				WshShell.Run( "cmd /c " + path + " " + args, 0 ); //if it is not a batch file then hide the batch window that spawns it
			}

		}
	} else {
		alert( "file parameter incorrectly set" )
	}
};

//runs the tiddler contents in a temporary batch location defaults to %TEMP%twexe.bat
TWExeWidget.prototype.runTiddler = function (event) {
	if (this.hasActiveX == false) { return;}

	var WshShell = new ActiveXObject("WScript.Shell");
	var fso = new ActiveXObject("Scripting.FileSystemObject");

	var file = FileName = WshShell.ExpandEnvironmentStrings(this.tmpDir.replace("\n","") + "\\twexe.bat");
	var f = fso.CreateTextFile(file, true);
	f.WriteLine(this.contents);
	f.Close();

	var args = this.tiddler_args;
	if (!args){ args = "";}

	WshShell.CurrentDirectory = WshShell.ExpandEnvironmentStrings(this.cwd);
	WshShell.Run( "cmd /c " + file + " " + args );
};

TWExeWidget.prototype.openFile = function (event) {
	if (this.hasActiveX == false) { return; }
	var WshShell = new ActiveXObject("WScript.Shell");
	if (this.target) {
		var path = WshShell.ExpandEnvironmentStrings(this.target.split("/").join("\\"));
		if (this.isFolder){
			WshShell.Run("explorer /e, " + path);		
		} else {
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

TWExeWidget.prototype.OpenTiddler = function (event,name) {	
	var bounds = this.domNodes[0].getBoundingClientRect();
	this.dispatchEvent({
		type: "tm-navigate",
		navigateTo: name,
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
	if (changedAttributes["class"] || changedAttributes.selectedClass || changedAttributes.style || changedAttributes.tiddler_name) {
		this.refreshSelf();
		return true;
	}
	return this.refreshChildren(changedTiddlers);
};

exports.twexe = TWExeWidget;

})();
