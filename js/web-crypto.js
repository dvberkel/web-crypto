(function(){
    console.log('Ready to do crypto');

    var databaseName = 'web-crypto-keys';
    var objectStoreName = 'keys';
    var entryId = 1;
    var databaseRequest = indexedDB.open(databaseName, 2);
    databaseRequest.onerror = function(event){
        console.log('database error: %o', event);
    };
    databaseRequest.onsuccess = function(event){
        var database = event.target.result;
        console.log('got a database');
        retrieveKey(database);
    };
    databaseRequest.onupgradeneeded = function(event){
        var database = event.target.result;
        database.deleteObjectStore(objectStoreName);
        var objectStore = database.createObjectStore(objectStoreName, { keyPath: 'id' } );
        objectStore.transaction.oncomplete = function(event){
            console.log('created an objectStore for %o', objectStoreName);
        };
    };

    function retrieveKey(database){
        var objectStore = database.transaction([objectStoreName], 'readwrite').objectStore(objectStoreName);
        var request = objectStore.get(entryId);
        request.onerror = function(event){ console.log('transaction error'); };
        request.onsuccess = function(event){
            var data = event.target.result;

            if (!data) {
                var keyPromise = crypto.subtle.generateKey(
                    {
                        name: 'RSA-OAEP',
                        modulusLength: 2048,
                        publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
                        hash: { name: 'SHA-256'}
                    },
                    true,
                    ['encrypt', 'decrypt']
                );
                keyPromise.then(function(key){
                    console.log('got a key');
                    console.log(key);
                    console.log(key.privateKey);
                    console.log(key.publicKey);
                    Promise.all([
                        crypto.subtle.exportKey("jwk", key.privateKey),
                        crypto.subtle.exportKey("jwk", key.publicKey)
                    ]).then(function(data){
                        var key = { id: entryId, privateKey: data[0], publicKey: data[1] };

                        // should not be necessary? but transaction is currently not active or finished
                        var objectStore = database.transaction([objectStoreName], 'readwrite').objectStore(objectStoreName);
                        request = objectStore.put(key);
                        request.onerror = function(event){ console.log('could not store key %o', event); };
                        request.onsuccess = function(event){ console.log('stored a key %o', event); };
                    }).catch(function(error){
                        console.log('could not export keys: %o', error);
                    });
                });
                keyPromise.catch(function(error){
                    console.log('no luck what so ever: %o', error);
                });
            } else {
                console.log('retrieved a key: %o', data);
                Promise.all([
                    crypto.subtle.importKey("jwk", data.privateKey, { name: 'RSA-OAEP', hash: { name: 'SHA-256'} }, true, ["decrypt"]),
                    crypto.subtle.importKey("jwk", data.publicKey, { name: 'RSA-OAEP', hash: { name: 'SHA-256'} }, true, ["encrypt"]),
                ]).then(function(data){
                    var key = { privateKey: data[0], publicKey: data[1] };
                    console.log('imported a key: %o', key);

                    var plain = "Hello, World";
                    var messageBuffer = (new TextEncoder('utf-8')).encode(plain);
                    crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key.publicKey, messageBuffer)
                        .then(function(encryptBuffer){
                            return crypto.subtle.decrypt({ name: 'RSA-OAEP' }, key.privateKey, encryptBuffer);
                        })
                        .then(function(decryptBuffer){
                            var decrypt = (new TextDecoder('utf-8')).decode(decryptBuffer);

                            console.log('from %o to %o', plain, decrypt);
                        })
                        .catch(function(error){
                            console.log('could not encrypt or decrypt: %o', error);
                        });
                }).catch(function(error){
                    console.log('could not import key: %o', error);
                });
            }
        };
    };
})();
