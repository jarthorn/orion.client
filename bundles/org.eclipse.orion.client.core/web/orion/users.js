/*******************************************************************************
 * Copyright (c) 2009, 2011 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 *
 * Contributors: IBM Corporation - initial API and implementation
 *******************************************************************************/

/*global define */

define([], function(){

	// TODO this is obsolete and should be removed. See bug 349080
	function UserService(serviceRegistry) {
		this._serviceRegistry = serviceRegistry;
		this._serviceRegistration = serviceRegistry.registerService("IUsers", this);
		this._user = null;
	}
 
	UserService.prototype = /** @lends orion.users.UserService */ {
	    setUser: function(user) {
			this._user = user;
		},
	    
		getUser: function(onDone) {
			onDone(this._user);
		}
	};
	//return module exports
	return {UserService: UserService};
});