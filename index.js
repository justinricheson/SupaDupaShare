'use strict';

const awsIot = require('aws-iot-device-sdk');

var syncId;
let client;
const IoT = {

    connect: (topic, iotEndpoint, region, accessKey, secretKey, sessionToken) => {
        client = awsIot.device({
            region: region,
            protocol: 'wss',
            accessKeyId: accessKey,
            secretKey: secretKey,
            sessionToken: sessionToken,
            port: 443,
            host: iotEndpoint,
            debug: true
        });

        client.on('connect', onConnect);
        client.on('message', onMessage);            
        client.on('error', onError);
        client.on('reconnect', onReconnect);
        client.on('offline', onOffline);
        client.on('close', onClose);     
    },

    send: (topic, message) => {
        addLog("Sending message: " + message + " to topic: " + topic);
        client.publish(topic, message);
    }  
}; 

const onConnect = () => {
    client.subscribe(getLocalTopic());
    addLog('Signal channel connected');

    syncId = setInterval(function(){
        IoT.send(getRemoteTopic(), "SYNC");
    }, 500);
};

const onMessage = (topic, message) => {
    addLog("Received message: " + message);

    if (message == "SYNC") {
        clearInterval(syncId);
        IoT.send(getRemoteTopic(), newSessionId());
    }
};

const onError = (err) => {
    addLog("Error: " + err);
};
const onReconnect = () => {
	addLog("Reconnected");
};
const onOffline = () => {
	addLog("Offline")
};

const onClose = () => {
    addLog('Disconnected');
};

$(document).ready(() => {
    $('#sessionid').val(newSessionId());

    $('#startshare').on('click', () => {
        addLog("Connecting...")
        $('#startshare').prop('disabled', true);
        $('#sessionid').prop('disabled', true);
        $('#isdevice').prop('disabled', true);

        $.ajax({
            url: 'https://8zzjkfhme0.execute-api.us-east-2.amazonaws.com/prod/credentials',
            success: (res) => {
                var localTopic = getLocalTopic();
                addLog("Subscribing to topic: " + localTopic);
                IoT.connect(localTopic,
                    res.iotEndpoint, 
                    res.region, 
                    res.accessKey, 
                    res.secretKey, 
                    res.sessionToken);
            }
        });
    });

    $('#isdevice').on('click', () => {
        var checked = $("#isdevice").prop('checked');
        $('#sessionid').prop('disabled', !checked);
    });  
});

const getRemoteTopic = () => {
    return getTopicBase() + ($('#isdevice').prop('checked') ? 'b' : 'a');
}

const getLocalTopic = () => {
    return getTopicBase() + ($('#isdevice').prop('checked') ? 'a' : 'b');
}

const getTopicBase = () => {
    return '/supadupashare/' + $('#sessionid').val() + '/';
}

const newSessionId = () => {
    return Math.floor((1 + Math.random()) * 0x1000000)
        .toString(16).substring(1);
}

const addLog = (msg) => {
    const date = (new Date()).toTimeString().slice(0, 8);
    $("#log").prepend(`<li>[${date}] ${msg}</li>`);
}