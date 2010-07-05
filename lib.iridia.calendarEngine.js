//	lib.iridia.calendarEngine.js
//	Evadne Wu at Iridia, 2010





window.iridia = (window && window.iridia || {})










//	Base URL.

	iridia.calendarEngineBaseURLWithIdentifier = function (inCalendarIdentifier, inPrivacyLevel, inDetailLevel) {
	
		inPrivacyLevel = inPrivacyLevel || "public";
		inDetailLevel = inDetailLevel || "full";
		
		return "http://www.google.com/calendar/feeds/" + String(inCalendarIdentifier) + "@group.calendar.google.com/" + inPrivacyLevel + "/" + inDetailLevel + "?alt=json-in-script&callback=?";
	
	}










//	The delegate protocol.  Implement me!

	iridia.calendarEngineDelegate = new JS.Interface([
	
		"calendarEngineDidLoad",
		"calendarEngineDidReceiveEvents"
	
	]);










//	Auxiliary Classes

	iridia.calendarEngineCalendarEvent = new JS.Class({
	
			initialize: function(event) {
	
				this.event = event;
	
			}
	
	});










//	Query Transforms.  All keys are tags for internal use, and all values are functions which take the input and returns a vanilla object that will be merged with other parameters to form the final query predicate.  For example, fromDate yields startMin, so the final predicate will contain a startMin.

	iridia.calendarEngineCalendarQueryTransforms = {
	
		"fromDate": function (inDate) {
		
			return {
			
				"start-min": inDate.format("#{YEAR, 4}-#{MONTH, 2}-01")
			
			};
		
		},
		
		"toDate": function(inDate) {
		
			return {
			
				"start-max": inDate.format("#{YEAR, 4}-#{MONTH, 2}-#{DAY, 2}")
			
			}
			
		}
	
	}
	
	
	
	
	
	iridia.calendarEngineCalendarEventTransforms = {
	
	}









	iridia.calendarEngine = new JS.Class({
	
		include: JS.Observable,
	
		initialize: function(inOptions, inDelegate) {
		
			mono.groupStart("Initializing calendar engine.");
			mono.log("Options: ", inOptions);
		
			this.setDelegate(inDelegate);
			this.options = $.extend(true, inOptions, {
			
				calendarID: undefined,
				initializeImmediately: true
			
			});
					
			if (!!this.delegate) this.delegate.calendarEngineDidLoad(this);
			
			if (!!this.options.initializeImmediately)
			if (!!this.options.queryPredicate)
			this.executeQuery(this.options.queryPredicate);
			
			mono.groupEnd();
		
		},
	
	
	
	
	
	//	Delegation
		
		setDelegate: function(inObject) {
		
			try {
			
				JS.Interface.ensure(inObject, iridia.calendarEngineDelegate);
			
			} catch (exception) {
			
				return mono.die(mono.error("Object passed to iridia.calendarEngine does not conform to iridia.calendarEngineDelegate.  Bailing."));
			
			}
			
			this.delegate = inObject;
			
		},
	
	
		
	
	
	//	Engine.
		
		executeQuery: function(queryHash) {
		
			if (typeof queryHash != "object") return;
			var finalQueryHash = {};
			
			$.each(queryHash, function(queryKey, queryValue) {
			
				if (queryValue == undefined) return false;
			
				if (iridia.calendarEngineCalendarQueryTransforms.hasOwnProperty(queryKey)) {
	
					finalQueryHash = $.extend(true, iridia.calendarEngineCalendarQueryTransforms[queryKey](queryValue), finalQueryHash);
				
				} else {
				
					finalQueryHash[queryKey] = queryValue;
				
				}
				
			});
			
			$.getJSON(iridia.calendarEngineBaseURLWithIdentifier(this.options.calendarID), finalQueryHash, this.processData);
			
		},
		
		processData: function(data) {
		
			mono.log("Calendar Engine shall process data", data);
			
		}
	
	});









