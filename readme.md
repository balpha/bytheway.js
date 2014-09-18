## ByTheWay

ByTheWay is a small (<1KB minified and gzipped) JavaScript library that allows you to easily communicate among all browser tabs that a user has open on your website. For example, you could

* reduce confusion by updating all browser tabs if the user adds something to their shopping cart,
* save bandwidth (for both your server and the user) by only having one browser tab poll your server for realtime updates,
* be less annoying by ensuring that if a notification is dismissed in one tab, it's dismissed in all of them,
* ease debugging by having multiple browser tabs all log messages to a single dashboard page,

and probably a million other things.

It is only made for communication across browser tabs *from the same domain* (or more precisely, origin).

## Example

    var messenger = ByTheWay("mychannelname");

    // if the user clicks "buy" in another tab, we'll be notified
    messenger.onReceive(function (message) {
        if (message == "newpurchase") {
            increaseShoppingCartCount();
        }
    });

    //...

    $("#buy").on("click", function () {
        sendPurchaseToServer();
        increaseShoppingCartCount();

        // let other tabs know that the user bought something
        messenger.broadcast("newpurchase");
    });

## Requirements

ByTheWay has no dependencies on other libraries. It uses the browser's localStorage for cross-tab communication, which is supported in all modern browsers. Internet Explorer is supported for version 9 and newer. ByTheWay doesn't break in IE8, but will only send messages inside the same tab, so there's no cross-tab communication. It doesn't currently work at all in IE7 and lower.

Note that even though localStorage is available in almost all browsers, it may be disabled for various reasons. Some browsers, for example, disable the localStorage (or make it read-only) in incognito mode. And the storage may also not work if the available space is full, or the user has simply disabled it. This is why the localStorage is great for convenience and nice-to-have functionality, but the core functionality of your site should probably work without it.

In the case of ByTheWay, if the localStorage is unavailable, each browser tab will simply think that it's the only one open from this domain, since no messages arrive from elsewhere.

## Usage

To use ByTheWay, just include bytheway.js in your page or asset manager.

### Creating a messenger

You create a messenger object by calling `ByTheWay` with a single parameter, the name of the localStorage key that will be used for communication.

    var messenger = ByTheWay("somekey");

Just make sure that you don't use the same key for other things you may be saving to localStorage or sessionStorage.

The function `ByTheWay` takes an optional second parameter called `receiveOwn`. It's false by default, but if you pass true, then any listeners that you attach will not only be notified of messages from other browser tabs, but also those that originated in this very browser tab.

    var messenger = ByTheWay("foobar", true); // receives messages coming from this tab

Had we used this in the example above, we wouldn't need to call `increaseShoppingCartCount()` in the click handler, because the "newpurchase" message would also be passed to the browser tab that the purchase was made in, and thus the message handler would have taken care of increasing the count.

### Messages and envelopes

A message is whatever you choose to send through a messenger. It can be a simple number, a string, or a more complex object, but it has to be JSON-serializable.

An envelope is the wrapper object that is actually passed around. It contains the message itself, and some metadata. In most cases you'll probably only care about the message itself, so you can ignore the envelope. Important properties of the envelope are

- `envelope.sender` The ID of the messenger that sent this message. You can use this to send a reply only to the browser tab that sent this message.
- `envelope.time` The time at which this message was sent, expressed as milliseconds since Jan 1st, 1970 (i.e. what `Date.now()` returns).
- `envelope.id` The ID of the message. This is simply an incrementing non-negative integer; it's only unique if you combine it with the sender ID.
- `envelope.message` This is the actual message object. You probably won't have to access it via this property, since whenever you have an envelope, you'll also be given the message directly.

### Receiving messages

To be notified of messages being sent on a channel, pass a callback to the messenger's `onReceive` method. This callback will receive up to three arguments; oftentimes you'll only pass a callback with just the first parameter.

    messenger.onReceive(function (message, envelope, responder) { ... })

The first argument is the message that was received. The second argument is its envelope; see the previous section. The third argument is only passed if the message is a request for a response; see below for more.

If a message was sent in the same browser tab, it will only be passed to the receiver callback if `onReceive` was called on a messenger that was created with the second argument set to true; see the section on creating a messenger.

### Sending messages

    messenger.broadcast(message)

sends the message to all browser tabs that are listening on the same channel (i.e. localStorage key). The message can be any JSON-serializable object.

    messenger.unicast(message, recipientId)

sends the message only to the browser tab that has the given ID. You can get this ID by looking at `envelope.sender` on the envelope of a message that you have previously received.

The browser tab's own ID is available as `messenger.id`. Note that these ID's are per-channel. If you send data over two different localStorage keys, then the corresponding messengers will have different IDs, even in the same browser tab.

    messenger.request(message, callback, [recipientId, [timeoutMs]])

sends a message that expects a response. All browser tabs that receive this message will have the `responder` argument passed to the `onReceive` callback. This argument is itself a function that can be called with the response message.

The `callback` argument to `request` will be called with two arguments; an array of messages and an array of envelopes (again, usually you'll just need the messages). The two arrays are guaranteed to be in the same order, so assuming there were at least three responses, `messages[2] === envelopes[2].message` is always true.

The optional parameter `recipientId` specifies the ID of the browser to send the request to (see the description of `unicast`); if this is not given, the request will be sent to all listening tabs.

The optional parameter `timeoutMs` defaults to 100ms and specifies how long we should wait for responses to come in before calling the callback.

### Request example

All this callback talk is a little confusing, so here's an example. Assume that once in a while, one browser tab needs to know the URLs that are open in the other browser tabs for the same site.

    messenger.onReceive(function (message, envelope, responder) {
        if (message === "plz send urls thx") {
            responder(location.href);
        }
    });

    // ...

    messenger.request("plz send urls thx", function (messages, envelopes) {
        console.log("URLs of other browser tabs: " + messages.join(", "));
    });

## License (MIT)

Copyright (c) 2013-2014, Benjamin Dumke-von der Ehe

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.