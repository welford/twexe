/*\
title: $:/plugins/welford/twsr/twsr.js
type: application/javascript
module-type: widget

twsr widget
\*/
(function(){
/*jslint node: true, browser: true */
/*global $tw: false */
//"use strict";

var g_field_prefix	= "twsr_";
//other data we try to grab
var g_src		= "tiddler";	//the tiddler that backs this data, if this is missing use "currentTiddler"
var Widget = require("$:/core/modules/widgets/widget.js").widget;
var g_showAnswer = false;
var g_questionElm = null;
var g_questionTiddler = null;

var TWSRWidget = function(parseTreeNode,options) {
	this.initialise(parseTreeNode, options);
};

//Inherit from the base widget class
TWSRWidget.prototype = new Widget();
//set class variables	initally to null, we will create them when we first get the chance

//no idea about the other SM algorithms
TWSRWidget.prototype.AddNewCards = function (amount) {
	var tiddler = $tw.wiki.getTiddler(this.tiddler_name);

	var tags = tiddler.getFieldList("tags");	
	var tagFilter = "",filter = "";	
	for(i = 0;i<tags.length;i++){
		var tag = tags[i];
		if(tag == "$:/tags/twsr") continue;
		tagFilter += "[tag["+tag+"]]";
	}
	filter = tagFilter + "+[!tag[$:/tags/twsr]]+[field:twsr_interval[]]";
	var tiddlers = $tw.wiki.filterTiddlers(filter);
	//WHAT SHOULD  WE SORT BY?
	//$tw.wiki.sortTiddlers(tiddlers, "twsr_interval"); 

	var newAddList = [];
	for(i = 0;i<tiddlers.length && i<amount;i++){
		$tw.wiki.setText(tiddlers[i], "twsr_grade",    undefined, 0);
		$tw.wiki.setText(tiddlers[i], "twsr_rnumber",  undefined, 0);
		$tw.wiki.setText(tiddlers[i], "twsr_efactor",  undefined, 2.5);
		$tw.wiki.setText(tiddlers[i], "twsr_interval", undefined, 0);
		newAddList.push(tiddlers[i]);
	}
	//filter out tiddlers whose twsr_interval date is in the future
	return newAddList;
}

//no idea about the other SM algorithms
TWSRWidget.prototype.GetScheduledCards = function (title) {
	//get defaults for things that are not set
	var tiddler = $tw.wiki.getTiddler(title);
	//new first, then scheduled, then poorly graded!

	//1. NEW
	var tags = tiddler.getFieldList("tags");	
	var tagFilter = "",filter = "";	
	for(i = 0;i<tags.length;i++){
		var tag = tags[i];
		if(tag == "$:/tags/twsr") continue;
		tagFilter += "[tag["+tag+"]]";
	}

	var tiddlers = [];
	if(tiddlers.length == 0)
	{
		//2. SCHEDULED
		filter = tagFilter + ":filter[get[twsr_interval]compare:date:lt["+$tw.utils.stringifyDate(new Date())+"]]+[!tag[$:/tags/twsr]]";
		tiddlers = $tw.wiki.filterTiddlers(filter);

		if(tiddlers.length == 0) {
			//3. POORLY GRADED
			filter = tagFilter + ":filter[get[twsr_grade]compare:number:lt[4]]";
			tiddlers = $tw.wiki.filterTiddlers(filter);
		}else{
			$tw.wiki.sortTiddlers(tiddlers, "twsr_interval");
		}
	}
	//filter out tiddlers whose twsr_interval date is in the future
	return tiddlers;
}

//no idea about the other SM algorithms
TWSRWidget.prototype.UpdateCardSM2 = function (title, grade) {

	var tiddler = $tw.wiki.getTiddler(title);
	// https://en.wikipedia.org/wiki/SuperMemo
	var rNumber = 0, eFactor = 2.5, interval = 0;
	if(tiddler.hasField["twsr_rnumber"]){
		rNumber = ParseInt(tiddler.getFieldString["twsr_rnumber"]);
	}
	if(tiddler.hasField["twsr_efactor"]){
		rNumber = ParseFloat(tiddler.getFieldString["twsr_efactor"]);
	}
	if(grade >= 3){
		if(rNumber == 0){
			interval = 1; //+1 days
		} 
		else if(rNumber == 1){
			interval = 6; //+6 days
		}
		else {
			interval = interval * eFactor;
		}
		//EF ← EF + (0.1 − (5 − q) × (0.08 + (5 − q) × 0.02))
		eFactor = eFactor + (0.1-(5-grade)*(0.08+(5-grade)*0.02))
		if(eFactor < 1.3){
			eFactor = 1.3;
		}
		rNumber++;
	}
	else{
		interval = 1; //+1 day
		rNumber = 0; 
		//what happens to e factor here
	}
	var date = new Date();
	var newDate = new Date(date.getTime() + (interval * 24 * 60 * 60 * 1000));
	$tw.wiki.setText(title, "twsr_grade",    undefined, grade);
	$tw.wiki.setText(title, "twsr_rnumber",  undefined, rNumber);
	$tw.wiki.setText(title, "twsr_efactor",  undefined, eFactor);
	$tw.wiki.setText(title, "twsr_interval", undefined, $tw.utils.stringifyDate(newDate));
}

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

TWSRWidget.prototype.OpenTiddler = function (event,name) {	
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

TWSRWidget.prototype.ShowCards = function (parent,nextSibling) {
	var _this = this;
	//grades
	var grades = {"again":0,"good":4,"easy":5};
	var addNew = {"+1":1,"+5":5,"+10":10};

	//divs
	var content = _this.document.createElement("div");

	var gradeDiv = _this.document.createElement("div");
	parent.insertBefore(gradeDiv,nextSibling);
	_this.renderChildren(gradeDiv, null);

	var showAnswer = _this.document.createElement("button");
	showAnswer.style.float = "left";
	showAnswer.style.display = "none";
	parent.insertBefore(showAnswer,nextSibling);
	_this.renderChildren(showAnswer, null);

	var completeDiv = _this.document.createElement("div");
	parent.insertBefore(completeDiv,nextSibling);
	_this.renderChildren(completeDiv, null);
	var card = _this.document.createElement("div");

	//. . . . .
	var index = 0, limit= 0, activeCard = null;
	var tiddlers =this.GetScheduledCards(this.tiddler_name);
	limit = tiddlers.length;
	
	var ShowCard = function (tiddler) {
		//make dom element here and then 
		//render questions to it, hide the 
		g_showAnswer = true;
		g_questionElm = null;//_this.document.createElement("div");
		g_questionTiddler = tiddler;

		var t = $tw.wiki.makeTranscludeWidget(tiddler, {document:document, variables:{"currentTiddler":tiddler}});
		card.innerHTML = "";
		content.innerHTML = "";
		t.render(content,null);
		content.style.display = "none";
		card.appendChild(content);
		if(g_questionElm) {
			showAnswer.innerHTML = "Show Answer";
			card.appendChild(g_questionElm);
			showAnswer.style.display = "block";
			gradeDiv.style.display = "none";
			//card.appendChild(showAnswer);
			showAnswer.onclick = function(){
				content.style.display = "block";
				gradeDiv.style.display = "block";
				g_questionElm.style.display = "none";
				showAnswer.style.display = "none";
			}
		}else{
			gradeDiv.style.display = "block";
			content.style.display = "block";
			showAnswer.style.display = "none";
		}

		activeCard = tiddler;
		g_questionTiddler = null;
		g_showAnswer = false;
	}

	var AllDone = function (mgs) {
		gradeDiv.style.display = "none";
		completeDiv.style.display = "inline";
		completeDiv.innerHTML = mgs;
		content.innerHTML = "";
	}

	var OnClickGrade = function (grade) {
		if(index >= limit) return;
		activeCard = null;
		_this.UpdateCardSM2(tiddlers[index], grade);
		ShowCard(tiddlers[++index]);
		if(index >= limit)
		{
			index = 0, limit= 0,activeCard = null;
			tiddlers = _this.GetScheduledCards(_this.tiddler_name);
			limit = tiddlers.length;
			if(limit == 0){
				AllDone("All Done, Well Done");
			}else {
				ShowCard(tiddlers[index]);
			}
		}
	}

	var OnClickAddNew = function (amount) {
		_this.AddNewCards(amount);
		if(index >= limit)
		{
			index = 0, limit= 0,activeCard = null;
			tiddlers = _this.GetScheduledCards(_this.tiddler_name);
			limit = tiddlers.length;
			if(limit == 0){
				AllDone("All Done, Well Done");
			}else {
				gradeDiv.style.display = "none";
				completeDiv.style.display = "none";
				ShowCard(tiddlers[index]);
			}
		}
	}
	

	// - - - - - - - - - - - - - - - - - - - - - - - -
	// GRADES
	// - - - - - - - - - - - - - - - - - - - - - - - -
	gradeDiv.innerHTML = "";
	gradeDiv.style.float = "left";
	gradeDiv.style.display = "none";
	
	completeDiv.innerHTML = "All Done, Well Done";
	completeDiv.style.display = "none";
	completeDiv.style.float = "left";

	for(key in grades){
		// Create element
		var button = _this.document.createElement("button");
		// Assign classes
		var classes = _this["class"].split(" ") || [];	
		button.className = classes.join(" ");
		// Assign styles
		if(_this.style) {
			button.setAttribute("style", _this.style);
		}
		//set the button name
		button.innerHTML = key;
		button.setAttribute("title", "todo (this comment)");		//set hover comment
		// Add a click event handler
		button.addEventListener("click",  (function(g)
			{ 
				return function(event) {
					OnClickGrade(g);
					event.preventDefault();
					event.stopPropagation();
					return true;
				};
			})(grades[key])
		, false);
		// Insert element
		gradeDiv.appendChild(button);
	}

	// - - - - - - - - - - - - - - - - - - - - - - - -
	// NEW CARDS
	// - - - - - - - - - - - - - - - - - - - - - - - -
	var settingsDiv = _this.document.createElement("span");
	settingsDiv.innerHTML = "⚙";
	parent.insertBefore(settingsDiv,nextSibling);
	_this.renderChildren(settingsDiv, null);

	var contextMenu = _this.document.createElement("div");
	contextMenu.innerHTML = "";
	contextMenu.style.display = "None";
	contextMenu.style.zIndex = "1000";
	contextMenu.style.position = "fixed";
	settingsDiv.appendChild(contextMenu);
	
	//settingsDiv.oncontextmenu = 
	settingsDiv.onclick = 
	function (event) {
		contextMenu.innerHTML = "";
		contextMenu.style.display = "block";
		contextMenu.style.top = mouseY(event) + "px";
		contextMenu.style.left = mouseX(event) + "px";
		var btns = [];
		var classes = _this["class"].split(" ") || [];	
		for(key in addNew){
			// Create element
			var button = _this.document.createElement("button");
			button.className = classes.join(" ");// Assign classes
			if(_this.style) { // Assign styles
				button.setAttribute("style", _this.style);
			}
			//set the button name
			button.innerHTML = key;
			button.style.width = "100%";
			button.style.display = "block";
			button.setAttribute("title", "");		//set hover comment
			// Add a click event handler
			button.addEventListener("click",  (function(g)
				{ 
					return function(event) {
						OnClickAddNew(g);
						event.preventDefault();
						event.stopPropagation();
						return true;
					};
				})(addNew[key])
			, false);
			//}(grades[g]);
			// Insert element	
			btns.push(button);
			contextMenu.appendChild(button);
		}

		{
			//ADD GOTO TIDDLER BUTTON
			var gotoTiddler = _this.document.createElement("button");
			gotoTiddler.className = classes.join(" ");
			if(_this.style) {
				gotoTiddler.setAttribute("style", _this.style);
			}
			//set the button name
			gotoTiddler.innerHTML = "tiddler";
			gotoTiddler.style.width = "100%";
			gotoTiddler.style.display = "block";

			gotoTiddler.addEventListener("click",function (event) {
				if(activeCard){
					_this.OpenTiddler(event,activeCard);
					event.preventDefault();
					event.stopPropagation();
				}
				return true;
			}, false);
			btns.push(gotoTiddler);
			contextMenu.appendChild(gotoTiddler);
		}

		function TMP(event) {
			for(var i =0;i<btns.length;i++){
				if (event.target == btns[i] ) {
					event.target.click();
				}
			}
			contextMenu.style.display = "None";
			document.removeEventListener('mousedown', TMP);
		}
		document.addEventListener('mousedown', TMP);

		return false;
	}
	
	// - - - - - - - - - - - - - - - - - - - - - - - -
	// CARD DETAILS
	// - - - - - - - - - - - - - - - - - - - - - - - -
	content.innerHTML = "";
	_this.domNodes.push(card);
	parent.insertBefore(card,nextSibling);
	_this.renderChildren(card, null);
	if(tiddlers.length > 0){
		ShowCard(tiddlers[index]);
	}else{
		AllDone("Nothing scheduled");
	}
}

// Render this widget into the DOM
TWSRWidget.prototype.render = function (parent,nextSibling) {
	// Remember parent
	this.parentDomNode = parent;
	// Compute attributes and execute state
	this.computeAttributes();
	this.execute();
	var self = this;
	this.ShowCards(parent,nextSibling);
};


TWSRWidget.prototype.OpenTiddler = function (event,name) {	
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

//Compute the internal state of the widget
TWSRWidget.prototype.execute = function () {
	//other genral attributes
	this.GetLatestDetails();
	this["class"] = this.getAttribute("class", "");
	this.style = this.getAttribute("style");
	this.selectedClass = this.getAttribute("selectedClass");
	this.defaultSetValue = this.getAttribute("default");
	// Make child widgets
	this.makeChildWidgets();	
};

TWSRWidget.prototype.GetLatestDetails = function ()
{
	//try to get from marco, is missing try to get from the 
	this.tiddler_name = this.getAttribute(g_src,this.getVariable("currentTiddler"));
}

//Selectively refreshes the widget if needed. Returns true if the widget or any of its children needed re-rendering
TWSRWidget.prototype.refresh = function (changedTiddlers) {
	var changedAttributes = this.computeAttributes();
	if (changedAttributes["class"] || changedAttributes.selectedClass || changedAttributes.style || changedAttributes.tiddler_name) {
		this.refreshSelf();
		return true;
	}
	return this.refreshChildren(changedTiddlers);
};

/////////////////////////////////////////////////////////////////////////////////////////////////////

var TWSRQuestion = function(parseTreeNode,options) {
	this.initialise(parseTreeNode, options);
};

//Inherit from the base widget class
TWSRQuestion.prototype = new Widget();

/*
Render this widget into the DOM
*/
TWSRQuestion.prototype.render = function(parent,nextSibling) {
	if(g_showAnswer){
		g_questionElm = this.document.createElement("div");
		Widget.prototype.render.call(this, g_questionElm, nextSibling);
	}
};

exports.twsr = TWSRWidget;
exports.question = TWSRQuestion;

})();
