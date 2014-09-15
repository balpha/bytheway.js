function Messenger(localStorageKey, receiveOwn) {
    var myId = Date.now() + "-" + Math.random();
    var counter = 0;
    var listeners = [];
    
    function broadcast(data) {
        var message = {
            source: myId,
            time: Date.now(),
            count: counter,
            data: data
        };
        counter++;
        var messageString = JSON.stringify(message);
        try {
            localStorage.setItem(localStorageKey, messageString);
        } catch (ex) {}
        if (receiveOwn)
            setTimeout(function () { notifyListeners(message); }, 0);
    }
    
    function onReceive(callback) {
        if (!listeners.length)
            window.addEventListener("storage", onStorage);
        listeners.push(callback);
    }

    function notifyListeners(message) {
        for (var i = 0; i < listeners.length; i++) {
            listeners[i](message.data, message);
        }
    }
    
    function onStorage(evt) {
        if (evt.key !== localStorageKey)
            return;
        var message = JSON.parse(evt.newValue);
        if (message.source === myId)
            return;
        notifyListeners(message);
    }
    
    return {
        broadcast: broadcast,
        onReceive: onReceive
    };
    
}