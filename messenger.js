function Messenger(localStorageKey, receiveOwn) {
    
    var currentTime = Date.now || function () { return new Date().getTime(); }
    
    var myId = currentTime() + "-" + Math.random();
    var counter = 0;
    var listeners = [];
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
                notifyListeners(JSON.parse(serializedEnvelope));
            });
        }, false)
        notifySelfAsync = function (serialized) {
            window.postMessage(messagePrefix + serialized, "*");
        }
    } else {
        notifySelfAsync = function (serialized) {
            setTimeout(function () {
                notifyListeners(JSON.parse(serialized));
            }, 0);
        }
    }
    
    function send(envelope) {
        var serialized = JSON.stringify(envelope);
        try {
            localStorage.setItem(localStorageKey, serialized);
        } catch (ex) {}
        
        if (receiveOwn) {
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
    
    function request(message, callback, timeoutMs, recipient) {
        var envelope = makeEnvelope(message);
        if (recipient)
            envelope.recipient = recipient;
        envelope.rsvp = true;
        pendingRequests[envelope.id] = [];
        setTimeout(function () {
            var responses = pendingRequests[envelope.id];
            delete pendingRequests[envelope.id];
            var messages = [];
            for (var i = 0; i < responses.length; i++) {
                messages.push(responses[i].message);
            }
            callback(messages, responses);
        }, timeoutMs || 50);
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
    
    function onReceive(callback) {
        if (!listeners.length && window.addEventListener)
            window.addEventListener("storage", onStorage);
        listeners.push(callback);
    }

    function notifyListeners(envelope) {
        if ("recipient" in envelope) {
            if (envelope.recipient !== myId)
                return;
            if ("inResponseTo" in envelope) {
                var pr = pendingRequests[envelope.inResponseTo];
                if (!pr)
                    return; // reponse came after timeout -- too late;
                pr.push(envelope);
                return;
            }
        }
        for (var i = 0; i < listeners.length; i++) {
            if (envelope.rsvp)
                listeners[i](envelope.message, envelope, responderFor(envelope));
            else
                listeners[i](envelope.message, envelope);
        }
    }
    
    function onStorage(evt) {
        if (evt.key !== localStorageKey)
            return;
        var envelope = JSON.parse(evt.newValue);

        if (envelope.sender === myId)
            return;

        notifyListeners(envelope);
    }
    
    return {
        broadcast: broadcast,
        unicast: unicast,
        onReceive: onReceive,
        request: request
    };
    
}