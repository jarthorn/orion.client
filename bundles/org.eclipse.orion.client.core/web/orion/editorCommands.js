/*******************************************************************************
 * Copyright (c) 2011 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
/*global window widgets eclipse:true orion:true serviceRegistry dojo dijit */
/*jslint maxerr:150 browser:true devel:true regexp:false*/


/**
 * @namespace The global container for orion APIs.
 */ 
define(['dojo', 'orion/commands', 'orion/globalCommands', 'orion/textview/keyBinding', 'orion/textview/undoStack'], function(dojo, mCommands, mGlobalCommands, mKeyBinding, mUndoStack) {

var exports = {};

exports.EditorCommandFactory = (function() {
	function EditorCommandFactory (serviceRegistry, commandService, fileClient, inputManager, toolbarId, isReadOnly) {
		this.serviceRegistry = serviceRegistry;
		this.commandService = commandService;
		this.fileClient = fileClient;
		this.inputManager = inputManager;
		this.toolbarId = toolbarId;
		this.isReadOnly = isReadOnly;
	}
	EditorCommandFactory .prototype = {
		/**
		 * Creates the common text editing commands.  Also generates commands for any installed plug-ins that
		 * contribute editor actions.  
		 */
		generateEditorCommands: function(editor) {
		
			// KB exists so that we can pass an array (from info.key) rather than actual arguments
			function KB(args) {
				return mKeyBinding.KeyBinding.apply(this, args);
			}
	
			// create commands common to all editors
			if (!this.isReadOnly) {
				editor.getTextView().setKeyBinding(new mKeyBinding.KeyBinding('s', true), "Save");
				editor.getTextView().setAction("Save", dojo.hitch(this, function () {
					var contents = editor.getTextView().getText();
					this.fileClient.write(this.inputManager.getInput(), contents).then(dojo.hitch(this, function() {
						editor.onInputChange(this.inputManager.getInput(), null, contents, true);
						if(this.inputManager.afterSave){
							this.inputManager.afterSave();
						}
					}));
					return true;
				}));
				var saveCommand = new mCommands.Command({
					name: "Save",
					id: "orion.save",
					callback: function(editor) {
						editor.getTextView().invokeAction("Save");
					}});
				this.commandService.addCommand(saveCommand, "dom");
				this.commandService.addCommandGroup("orion.editorActions.unlabeled", 200, null, null, this.toolbarId);
				this.commandService.registerCommandContribution("orion.save", 1, this.toolbarId, "orion.editorActions.unlabeled", new mCommands.CommandKeyBinding('s', true));
	
				// add the commands generated by plug-ins who implement the "orion.edit.command" extension.
				// we currently position these first so that the regular commands always appear in the same place (on the right) regardless of installed plug-ins
				// eventually we should define command groups that are more functional in nature and that would require the extension knowing where it wants to be
				this.commandService.addCommandGroup("orion.editorActions.contributed.noImages", 100, "More", null, this.toolbarId);
				this.commandService.addCommandGroup("orion.editorActions.contributed.images", 101, null, null, this.toolbarId);
		
				// Note that the shape of the "orion.edit.command" extension is not in any shape or form that could be considered final.
				// We've included it to enable experimentation. Please provide feedback in the following bug:
				// https://bugs.eclipse.org/bugs/show_bug.cgi?id=337766
		
				// The shape of the contributed actions is (for now):
				// info - information about the action (object).
				//        required attribute: name - the name of the action
				//        optional attribute: key - an array with values to pass to the orion.textview.KeyBinding constructor
				//        optional attribute: img - a URL to an image for the action
				// run - the implementation of the action (function).
				//        arguments passed to run: (selectedText, fullText, selection)
				//          selectedText (string) - the currently selected text in the editor
				//          fullText (string) - the complete text of the editor
				//          selection (object) - an object with attributes: start, end
				//        the return value of the run function will be used as follows:
				//          if the return value is a string, the current selection in the editor will be replaced with the returned string
				//          if the return value is an object, its "text" attribute (required) will be used to replace the contents of the editor,
				//                                            and its "selection" attribute (optional) will be used to set the new selection.
			
				// iterate through the extension points and generate commands for each one.
				var actionReferences = this.serviceRegistry.getServiceReferences("orion.edit.command");
						
				for (var i=0; i<actionReferences.length; i++) {
					this.serviceRegistry.getService(actionReferences[i]).then(dojo.hitch(this, function(service) {
						var info = {};
						var propertyNames = actionReferences[i].getPropertyNames();
						for (var j = 0; j < propertyNames.length; j++) {
							info[propertyNames[j]] = actionReferences[i].getProperty(propertyNames[j]);
						}
						var editorWidget = editor.getTextView();
						var command = new mCommands.Command({
							name: info.name,
							image: info.img,
							id: info.name,
							callback: dojo.hitch(editor, function(editor) {
								// command service will provide editor parameter but editor widget callback will not
								var editorWidget = editor ? editor.getTextView() : this.getTextView();
								var text = editorWidget.getText();
								var selection = editorWidget.getSelection();
								service.run(editorWidget.getText(selection.start,selection.end),text,selection).then(function(result){
									if (result.text) {
										editorWidget.setText(result.text);
										if (result.selection) {
											editorWidget.setSelection(result.selection.start, result.selection.end);
											editorWidget.focus();
										}
									} else {
										if (typeof result === 'string') {
											editorWidget.setText(result, selection.start, selection.end);
											editorWidget.setSelection(selection.start, selection.end);
											editorWidget.focus();
										}
									}
								});
								return true;
							})});
						this.commandService.addCommand(command, "dom");
						if (info.img) {
							// image will be placed on toolbar
							this.commandService.registerCommandContribution(command.id, i, this.toolbarId, "orion.editorActions.contributed.images");
						} else {
							// if there is no image it will be grouped in a "More..." menu button
							this.commandService.registerCommandContribution(command.id, i, this.toolbarId, "orion.editorActions.contributed.noImages");
						}
						// We must regenerate the command toolbar everytime we process an extension because
						// this is asynchronous and we probably have already populated the toolbar.
						// In the editor, we generate page level commands to the banner.
						mGlobalCommands.generateDomCommandsInBanner(this.commandService, editor);
						if (info.key) {
							// add it to the editor as a keybinding
							KB.prototype = mKeyBinding.KeyBinding.prototype;
							editorWidget.setKeyBinding(new KB(info.key), command.id);
							editorWidget.setAction(command.id, command.callback);
						}
					}));
				}
			}
		}
	};
	return EditorCommandFactory;
}());

exports.UndoCommandFactory = (function() {
	function UndoCommandFactory(serviceRegistry, commandService, toolbarId) {
		this.serviceRegistry = serviceRegistry;
		this.commandService = commandService;
		this.toolbarId = toolbarId;
	}
	UndoCommandFactory.prototype = {
		createUndoStack: function(editor) {
			var undoStack =  new mUndoStack.UndoStack(editor.getTextView(), 200);
			editor.getTextView().setKeyBinding(new mKeyBinding.KeyBinding('z', true), "Undo");
			editor.getTextView().setAction("Undo", function() {
				undoStack.undo();
				return true;
			});
			var undoCommand = new mCommands.Command({
				name: "Undo",
				id: "orion.undo",
				callback: function(editor) {
					editor.getTextView().invokeAction("Undo");
				}});
			this.commandService.addCommand(undoCommand, "dom");
			
			var isMac = navigator.platform.indexOf("Mac") !== -1;
			var binding = isMac ? new mKeyBinding.KeyBinding('z', true, true) : new mKeyBinding.KeyBinding('y', true);
			editor.getTextView().setKeyBinding(binding, "Redo");
			
			editor.getTextView().setAction("Redo", function() {
				undoStack.redo();
				return true;
			});
	
			var redoCommand = new mCommands.Command({
				name: "Redo",
				id: "orion.redo",
				callback: function(editor) {
					editor.getTextView().invokeAction("Redo");
				}});
			this.commandService.addCommand(redoCommand, "dom");
	
			this.commandService.registerCommandContribution("orion.undo", 400, this.toolbarId, "orion.editorActions.unlabeled", new mCommands.CommandKeyBinding('z', true), true);
			this.commandService.registerCommandContribution("orion.redo", 401, this.toolbarId, "orion.editorActions.unlabeled", binding, true);

			return undoStack;
		}
	};
	return UndoCommandFactory;
}());

return exports;	
});
