//	lib.irCalendarEngine.js
//	Evadne Wu at Iridia, 2010





	window.iridia = (window && window.iridia || {});










//	Base URL.

	iridia.calendarEngineBaseURLWithIdentifier = function (inCalendarIdentifier, inPrivacyLevel, inDetailLevel) {
	
		inPrivacyLevel = inPrivacyLevel || "public";
		inDetailLevel = inDetailLevel || "full";
		
		return "http://www.google.com/calendar/feeds/" + String(inCalendarIdentifier) + "@group.calendar.google.com/" + inPrivacyLevel + "/" + inDetailLevel + "?alt=json-in-script&callback=?";
	
	}
	
	
	
	
	
	iridia.calendarEngineGetSubscriptionURLWithIdentifier = function (inCalendarIdentifier) {
	
		return "http://www.google.com/calendar/render?cid=" + String(inCalendarIdentifier) + "@group.calendar.google.com"
		
	}










//	The delegate protocol.  Implement me!

	iridia.calendarEngineDelegate = new JS.Interface([
	
		"calendarEngineDidLoad",
		
		"calendarEngineShouldSendRequest",
		
		"calendarEngineDidStartLoadingEvents",
		"calendarEngineDidReceiveEvents",
		"calendarEngineShouldRetry",			//	Called on timeout
		
		"calendarEngineEndpointUnavailable"
	
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
	
		initialize: function(inOptions, inDelegate, inContext) {
		
			mono.groupStart("Initializing calendar engine.");
			mono.log("Options: ", inOptions);
		
			this.setDelegate(inDelegate);
			
			if (this.delegate === undefined)
			mono.info("Since there is no legit delegate this instance of irCalendarEngine will not even work.  Set one!");
			
			this.options = $.extend(true, {
			
				"calendarID": undefined,
				"methodImmediatelyExecutes": true,
				"methodName": "",
				"methodArguments": {},
				"context": inContext
			
			}, inOptions);
					
			this.delegate.calendarEngineDidLoad(this);
			
			if (!!this.options.methodImmediatelyExecutes)
			if (!!this.options.methodArguments)
			this.executeQuery(this.options.methodName, this.options.methodArguments);
			
			mono.groupEnd();
		
		},
	
	
	
	
	
	//	Delegation
		
		setDelegate: function(inObject) {
		
			try {
			
				JS.Interface.ensure(inObject, iridia.calendarEngineDelegate);
			
			} catch (exception) {
			
				return mono.die(mono.error(exception));
			
			}
			
			this.delegate = inObject;
			
		},
	
	
	
	
	
	//	Engine.
		
		executeQuery: function(methodName, queryHash) {
		
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
					
			$.jsonp({
			
				url: iridia.calendarEngineBaseURLWithIdentifier(this.options.calendarID),
				
				context: {
				
					engine: this,
					method: methodName
					
				},
				
				data: finalQueryHash,				
				callback: (function() {
					
					return "_jsonp" + ((Math.random() * (new Number(Math.pow(2, 4 * 8))))).toString(16) + ((Math.random() * (new Number(Math.pow(2, 4 * 8))))).toString(16);
					
				})(),
				
				pageCache: true,
				
				beforeSend: function (xOptions) {
				
					if (!xOptions.context.engine.delegate.calendarEngineShouldSendRequest.call(xOptions.context.engine.delegate)) {
					
						xOptions.abort();
					
					} else {
					
						xOptions.context.engine.delegate.calendarEngineDidStartLoadingEvents.call(xOptions.context.engine.delegate, xOptions.context.engine);
					
					}
				
				},
				
				success: (function(calendarEngineReference, successHandler, inMethodName) {
					
					return function(inJSONData, textStatus) {
					
						successHandler(calendarEngineReference, inMethodName, inJSONData, textStatus);
						
					}
					
				})(this, this.onRequestSuccess, methodName),
				
				complete: this.onRequestComplete
				
			});
			
		},
		
		
		
		
		
	//	Request Handlers
		
		onRequestSuccess: function(calendarEngine, methodName, inJSONData, textStatus) {
		
		//	Since this handler is called by $.jsonp, we jump thru a few bounds to make it back to JS.Class
		
			if (typeof calendarEngine.processData[methodName] != "function") return;
			calendarEngine.processData[methodName].call(calendarEngine, inJSONData);
			
		},
		
		onRequestComplete: function(xOptions, textStatus) {
		
			switch (textStatus) {
			
				case "error":
									
					xOptions.context.engine.delegate.calendarEngineEndpointUnavailable.call(xOptions.context.engine.delegate, xOptions.context.engine);

					break;
				
				case "timeout":
				
					if (!xOptions.context.engine.delegate.calendarEngineShouldRetry.call(xOptions.context.engine.delegate, xOptions.context.engine)) {

						xOptions.context.engine.delegate.calendarEngineEndpointUnavailable.call(xOptions.context.engine.delegate, xOptions.context.engine);
					
					} else {
					
						$.jsonp(xOptions);
					
					}
					
					break;

				case "success":
				default:

					break;
			
			}
			
		},
	
	
	
	
	
	//	Processes
		
		processData: {
		
			"fetchEvents": function(inData) {

				var eventEntries = eval("inData.feed.entry");
				if (eventEntries === undefined) return;
				
				var regulatedEventObjects = [];
				
				$.each(eventEntries, function(eventIndex, eventObject) {
				
					$.each(eventObject['gd$when'], function(eventRecurrenceIndex, eventRecurrenceTimespan) {
					
						var eventTime = eventRecurrenceTimespan;
					
						var eventStartTime = eventTime && eventTime.startTime || "";
						var eventEndTime = eventTime && eventTime.endTime || "";
						
						var eventTakesAllDay = false;
						
						var eventStartDate = Date.fromISO8601(eventStartTime);
						
						if (eventStartDate == undefined) {
						
							eventStartDate = Date.fromISO8601(eventStartTime, true);
							
							eventTakesAllDay = eventTakesAllDay || true;
							
						}
						
						var eventEndDate = Date.fromISO8601(eventEndTime);
						if (eventEndDate == undefined) {
						
							eventEndDate = Date.fromISO8601(eventEndTime, true);
							
							eventTakesAllDay = eventTakesAllDay || true;
							
						}
											
						regulatedEventObjects.push({

							title: eventObject.title && eventObject.title['$t'] || "",
	
							content: eventObject.content && eventObject.content['$t'] || "",
	
							startDate: eventStartDate,
							endDate: eventEndDate,
							
							takesAllDay: eventTakesAllDay,
	
							link: eventObject.link,
							
							private: ((eventObject["gCal$privateCopy"] && eventObject["gCal$privateCopy"]["value"] || "false") == "true")
						
						});
						
					});
					
				});
				
				regulatedEventObjects.sort(function(firstObject, secondObject) {
				
				//	< 0: firstObject comes first
				//	0: ordered same
				//	> 0: secondObject comes first
				
					return (Number(firstObject && firstObject.startDate) - Number(secondObject && secondObject.startDate));
					
				});
				
				this.delegate.calendarEngineDidReceiveEvents.call(this.delegate, this, regulatedEventObjects);
				
				mono.groupEnd();
				
			}
		
		}
	
	});









