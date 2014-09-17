(function (window) {
    
    var messengers = {};
    
    window.Messenger = function (localStorageKey, receiveOwn) {
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
            request: function (message, callback, timeoutMs, recipient) {
                return result.request(message, callback, timeoutMs, recipient, receiveOwn);
            },
            id: result.id
        };
    }
    
    function makeMessenger(localStorageKey) {
        
        var currentTime = Date.now || function () { return new Date().getTime(); }
        
        var myId = currentTime() + "-" + Math.random();
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
        if (window.postMessage && window.addEventListener) {
            var messagePrefix = "messenger-self-" + myId + "-";
            var messagePrefixRe = new RegExp("^" + messagePrefix + "(.*)$"); // the prefix contains no regex-active characters, so no need for escaping
            window.addEventListener("message", function (evt) {
                if (evt.source !== window)
                    return;
                evt.data.replace(messagePrefixRe, function (wholeMatch, serializedEnvelope) {
                    notifyListeners(JSON.parse(serializedEnvelope), ownListeners);
                });
            }, false)
            notifySelfAsync = function (serialized) {
                window.postMessage(messagePrefix + serialized, "*");
            }
        } else {
            notifySelfAsync = function (serialized) {
                setTimeout(function () {
                    notifyListeners(JSON.parse(serialized), ownListeners);
                }, 0);
            }
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
        
        function request(message, callback, timeoutMs, recipient, receiveOwn) {
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
            if (!externalListeners.length && window.addEventListener)
                window.addEventListener("storage", onStorage);
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
        
        function onStorage(evt) {
            if (evt.key !== localStorageKey)
                return;
            if (!evt.newValue)
                return;
            
            var envelope = JSON.parse(evt.newValue);
    
            if (envelope.sender === myId)
                return;
    
            notifyListeners(envelope, externalListeners);
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
