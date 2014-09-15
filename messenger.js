function Messenger(localStorageKey, receiveOwn) {
    var myId = Date.now() + "-" + Math.random();
    var counter = 0;
    var listeners = [];
    var pendingRequests = {};
    
    function makeEnvelope(message) {
        var result = {
            sender: myId,
            time: Date.now(),
            id: counter,
            message: message
        };        
        counter++;
        return result;
    }
    
    function send(envelope) {
        var serialized = JSON.stringify(envelope);
        try {
            localStorage.setItem(localStorageKey, serialized);
        } catch (ex) {}
        if (receiveOwn)
            setTimeout(function () { notifyListeners(envelope); }, 0);
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
        if (!listeners.length)
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