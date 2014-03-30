twexe
=====

Tiddlywiki widget to run batch/exes on a local machine. Intended for an hta flavoured TW, not suitable for anything online.

#Usage

## Create a defining tiddler 

in *.tid format this is:

```
tags: $:/tags/twexe
title: twexe_example
twexe_target: C:\somefolder\test.bat
twexe_title: button_name
type: text/vnd.tiddlywiki

sample test explaining the tool 
```

The important parts are that it contains the two fields

twexe_target : a path to the folder or exe you wish to open
and
twexe_title  : the text on the button displayed (if no supplied it will default to the tiddler title)

also optionally it can be tagged with $:/tags/twexe, which adds the button automatically to the bottom of the tiddler when it is displayed normally in the story river (i.e. not called via $twexe)

## Create a twexe widget referencing the above Tiddler

In a different tiddler put :

```<$twexe tiddler="twexe_example">```

this will create a button displaying "button_name" which when clicked runs C:\somefolder\test.bat.

Right clicking the button gives you the options to open the file in it's folder, to copy the path to the clipboard, and to open the defining tiddler.

If twexe_target is a folder then clicking on the button will simply open the folder.

