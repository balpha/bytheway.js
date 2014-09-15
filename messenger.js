function Messenger(localStorageKey, receiveOwn) {
    var myId = Date.now() + "-" + Math.random();
    var counter = 0;
    var listeners = [];
    var pendingRequests = {};
    
    function makeMessage(data) {
        var result = {
            sender: myId,
            time: Date.now(),
            count: counter,
            data: data
        };        
        counter++;
        return result;
    }
    
    function send(message) {
        var messageString = JSON.stringify(message);
        try {
            localStorage.setItem(localStorageKey, messageString);
        } catch (ex) {}
        if (receiveOwn)
            setTimeout(function () { notifyListeners(message); }, 0);
    }
        
    function broadcast(data) {
        send(makeMessage(data));
    }
    
    function unicast(data, recipient) {
        var message = makeMessage(data);
        message.recipient = recipient;
        send(message);
    }
    
    function request(data, callback, timeoutMs, recipient) {
        var message = makeMessage(data);
        message.rsvp = true;
        pendingRequests[message.count] = [];
        setTimeout(function () {
            var responses = pendingRequests[message.count];
            delete pendingRequests[message.count];
            var data = [];
            for (var i = 0; i < responses.length; i++) {
                data.push(responses[i].data);
            }
            callback(data, responses);
        }, timeoutMs || 50);
        send(message);
    }
    
    function responderFor(message) {
        return function (data) {
            var response = makeMessage(data);
            response.recipient = message.sender;
            response.inResponseTo = message.count;
            send(response);
        }
    }
    
    function onReceive(callback) {
        if (!listeners.length)
            window.addEventListener("storage", onStorage);
        listeners.push(callback);
    }

    function notifyListeners(message) {
        if ("recipient" in message) {
            if (message.recipient !== myId)
                return;
            if ("inResponseTo" in message) {
                var pr = pendingRequests[message.inResponseTo];
                if (!pr)
                    return; // reponse came after timeout -- too late;
                pr.push(message);
                return;
            }
        }
        for (var i = 0; i < listeners.length; i++) {
            if (message.rsvp)
                listeners[i](message.data, message, responderFor(message));
            else
                listeners[i](message.data, message);
        }
    }
    
    function onStorage(evt) {
        if (evt.key !== localStorageKey)
            return;
        var message = JSON.parse(evt.newValue);

        if (message.sender === myId)
            return;
        
        notifyListeners(message);
    }
    
    return {
        broadcast: broadcast,
        unicast: unicast,
        onReceive: onReceive,
        request: request
    };
    
}