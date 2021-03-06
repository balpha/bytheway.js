(function (window) {
    
    var currentTime = Date.now || function () { return new Date().getTime(); }
    var myId = currentTime() + "-" + Math.random();
    
    var messengers = {};
    
    window.ByTheWay = function (localStorageKey, receiveOwn) {
        var k = "m_" + localStorageKey;
        var result = messengers[k];
        if (!result) {
            messengers[k] = result = makeMessenger(localStorageKey);
        }
        return {
            broadcast: result.broadcast,
            unicast: result.unicast,
            onReceive: function (callback) {
                return result.onReceive(callback, receiveOwn);
            },
            request: function (message, callback, recipient, timeoutMs) {
                return result.request(message, callback, recipient, timeoutMs, receiveOwn);
            },
            id: result.id
        };
    }
    
    function regexEscape(s) {
        return s.replace(/[$^.+*\\[\]()?|{}]/g, "\\$&");
    }
    // the postMessage prefix ends with an exclamation point, so we want to
    // prevent that character from being part of the prefix itself.
    function postMessageEscape(s) {
        return s.replace(/%/g, "%%").replace(/!/g, "%-");
    }
    
    var postMessagePrefix = "bytheway-self-" + myId + "-";
    var localNotifiers;
    function ensurePostMessageListener() {
        if (localNotifiers)
            return;
        localNotifiers = {};
        var messagePrefixRe = new RegExp("^" + postMessagePrefix + "([^!]*)!(.*)$"); // the prefix contains no regex-active characters, so no need for escaping
        window.addEventListener("message", function (evt) {
            if (evt.source !== window)
                return;
            evt.data.replace(messagePrefixRe, function (wholeMatch, escapedLocalStorageKey, serializedEnvelope) {
                var notifier = localNotifiers["m_" + escapedLocalStorageKey];
                if (notifier)
                    notifier(JSON.parse(serializedEnvelope));
            });
        }, false)
    }
    
    var storageNotifiers;
    function ensureStorageListener() {
        if (storageNotifiers || ! window.addEventListener)
            return;
        storageNotifiers = {};
        window.addEventListener("storage", function onStorage(evt) {
            var notifier = storageNotifiers["m_" + evt.key];
            if (!notifier)
                return;
            if (!evt.newValue)
                return;
            
            try {
                var envelope = JSON.parse(evt.newValue);
            } catch (ex) {
                return;
            }
    
            if (envelope.sender === myId)
                return;
    
            notifier(envelope);
        });
    }    
    
    function makeMessenger(localStorageKey) {
        
        var counter = 0;
        
        var externalListeners = [];
        var ownListeners = [];
        
        var pendingRequests = {};
        
        function makeEnvelope(message) {
            var result = {
                sender: myId,
                time: currentTime(),
                id: counter,
                message: message
            };        
            counter++;
            return result;
        }
        
        var notifySelfAsync;
        // In non-foreground tabs, some browsers will delay setTimeouts by quite a bit,
        // but message events are passed immediately.
        if (window.postMessage && window.addEventListener) {
            ensurePostMessageListener();
            var escaped = postMessageEscape(localStorageKey);
            var channelPrefix = postMessagePrefix + escaped + "!";
            localNotifiers["m_" + escaped] = function (envelope) {
                notifyListeners(envelope, ownListeners)
            }
            notifySelfAsync = function (serialized) {
                window.postMessage(channelPrefix + serialized, "*");
            }
        } else {
            notifySelfAsync = function (serialized) {
                setTimeout(function () {
                    notifyListeners(JSON.parse(serialized), ownListeners);
                }, 0);
            }
        }
        
        ensureStorageListener();
        storageNotifiers["m_" + localStorageKey] = function (envelope) {
            notifyListeners(envelope, externalListeners);
        }
        
        function send(envelope) {
            var serialized = JSON.stringify(envelope);
            try {
                localStorage.setItem(localStorageKey, serialized);
            } catch (ex) {}
            
            if (ownListeners.length) {
                notifySelfAsync(serialized);
            }
        }
            
        function broadcast(message) {
            send(makeEnvelope(message));
        }
        
        function unicast(message, recipient) {
            var envelope = makeEnvelope(message);
            envelope.recipient = recipient;
            send(envelope);
        }
        
        function request(message, callback, recipient, timeoutMs, receiveOwn) {
            var envelope = makeEnvelope(message);
            if (recipient)
                envelope.recipient = recipient;
            envelope.rsvp = true;
            pendingRequests[envelope.id] = [];
            setTimeout(function () {
                var responses = pendingRequests[envelope.id];
                delete pendingRequests[envelope.id];
                var messages = [];
                var envelopes = [];
                for (var i = 0; i < responses.length; i++) {
                    if (receiveOwn || responses[i].sender !== myId) {
                        messages.push(responses[i].message);
                        envelopes.push(responses[i]);
                    }
                }
                callback(messages, envelopes);
            }, timeoutMs || 100);
            send(envelope);
        }
        
        function responderFor(envelope) {
            return function (responseMsg) {
                var responseEnv = makeEnvelope(responseMsg);
                responseEnv.recipient = envelope.sender;
                responseEnv.inResponseTo = envelope.id;
                send(responseEnv);
            }
        }
        
        function onReceive(callback, receiveOwn) {
            externalListeners.push(callback);
            if (receiveOwn)
                ownListeners.push(callback);
        }
    
        function notifyListeners(envelope, listenersArray) {
            if ("recipient" in envelope) {
                if (envelope.recipient !== myId)
                    return;
                if ("inResponseTo" in envelope) {
                    var pr = pendingRequests[envelope.inResponseTo];
                    if (!pr)
                        return; // reponse came after timeout -- too late
                    pr.push(envelope);
                    return;
                }
            }
            for (var i = 0; i < listenersArray.length; i++) {
                if (envelope.rsvp)
                    listenersArray[i](envelope.message, envelope, responderFor(envelope));
                else
                    listenersArray[i](envelope.message, envelope);
            }
        }
        
        return {
            broadcast: broadcast,
            unicast: unicast,
            onReceive: onReceive,
            request: request,
            id: myId
        };
        
    }
    
})(window);
