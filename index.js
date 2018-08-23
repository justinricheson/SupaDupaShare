'use strict';

const awsIot = require('aws-iot-device-sdk');

let localStream;
let peerConnection;
let peerConnectionConfig = {
    'iceServers': []
};
let peerConnectionOptionalConfig = {
    'optional': [{DtlsSrtpKeyAgreement: true}] // Danger, Will Robinson!
};
const webrtc = {
    initCall: function() {
        peerConnection = new RTCPeerConnection(peerConnectionConfig, peerConnectionOptionalConfig);
		peerConnection.oniceconnectionstatechange = function(event) {
			addLog("Media connection state: " + peerConnection.iceConnectionState);
			if (peerConnection.iceConnectionState === "failed" ||
				peerConnection.iceConnectionState === "disconnected" ||
				peerConnection.iceConnectionState === "closed") {
				addLog("Detected media channel error");
				connectMedia();
			}
		};

        peerConnection.onicecandidate = (event) => {
            if(event.candidate != null && event.candidate.candidate != null) {
                var candidate = event.candidate.candidate;
                if(candidate.indexOf("relay") < 0){
                    addLog("Skipping sending non-TURN candidate")
                    return;
                }

                iot.send(getRemoteTopic(), JSON.stringify({
                    'ice': event.candidate}));
            }
        };
        peerConnection.onaddstream = (event) => {
            $('#remotevideo').prop('src', window.URL.createObjectURL(event.stream));
        };
        peerConnection.addStream(localStream);
    },

    createOffer: function() {
        peerConnection.createOffer((description) => {
            peerConnection.setLocalDescription(description, function () {
                iot.send(getRemoteTopic(), JSON.stringify({'sdp': description}));
            }, function() { addLog('Error setting description'); });
        }, (error) => { addLog(error); });
    }
};

let syncId;
let client;
let gotMessage;
let syncSent = 0;
const iot = {

    connect: (iotEndpoint, region, accessKey, secretKey, sessionToken) => {
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
    addLog('Signal channel connected');

    let localTopic = getLocalTopic();
    addLog("Subscribing to topic: " + localTopic);
    client.subscribe(localTopic);

    syncId = setInterval(function(){
        if (gotMessage) {
            if (syncSent == 3) {
                clearInterval(syncId);
                return;
            }

            syncSent++;
        }

        iot.send(getRemoteTopic(), "SYNC");
    }, 500);
};

const connectMedia = () => {
    if (!isGuest()) {
        webrtc.createOffer();
    }
}

const onMessage = (topic, message) => {
    addLog("Received message: " + message);

    if (!gotMessage) {
        gotMessage = true;
        webrtc.initCall();
        if (!isGuest()) {
            connectMedia();
        }
    }

    if (message != "SYNC") {
        var signal = JSON.parse(message);
        if(signal.sdp) {
            peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp), function() {
                if(signal.sdp.type == 'offer') {
                    peerConnection.createAnswer((description) => {
                        peerConnection.setLocalDescription(description, function () {
                            iot.send(getRemoteTopic(), JSON.stringify({'sdp': description}));
                        }, () => { addLog('Error setting description'); });
                    }, (error) => { addLog(error); });
                }
            });
        } else if(signal.ice) {
            peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice));
        }
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
    disableUI();

    navigator.getUserMedia({
        video: true,
        audio: false,
    }, getUserMediaSuccess, getUserMediaError);

    $('#sessionid').val(newSessionId());

    $('#startshare').on('click', () => {
        addLog("Connecting...")
        disableUI();

        $.ajax({
            url: 'https://8zzjkfhme0.execute-api.us-east-2.amazonaws.com/prod/credentials',
            success: (res) => {
            	res.turnServers.forEach(turnServer => {
	                peerConnectionConfig.iceServers.push(
            	        {
				            'urls': 'turn:' + turnServer + ':3478?transport=udp',
				            'username': 'TEST',
				            'credential': 'TEST'
				        });
            	});

                iot.connect(
                    res.iotEndpoint, 
                    res.region, 
                    res.accessKey, 
                    res.secretKey, 
                    res.sessionToken);
            }
        });
    });

    $('#isguest').on('click', () => {
        $('#sessionid').prop('disabled', !isGuest());
    }); 
});

const getUserMediaSuccess = (stream) => {
    enableUI();

    localStream = stream;
    $('#localvideo').prop('src', window.URL.createObjectURL(stream));
}

const getUserMediaError = () => {
    addLog("Error getting user media");
}

const enableUI = () => {
    $('#startshare').prop('disabled', false);
    $('#sessionid').prop('disabled', !isGuest());
    $('#isguest').prop('disabled', false);
}

const disableUI = () => {
    $('#startshare').prop('disabled', true);
    $('#sessionid').prop('disabled', true);
    $('#isguest').prop('disabled', true);
}

const getRemoteTopic = () => {
    return getTopicBase() + (isGuest() ? 'b' : 'a');
}

const getLocalTopic = () => {
    return getTopicBase() + (isGuest() ? 'a' : 'b');
}

const getTopicBase = () => {
    return '/supadupashare/' + $('#sessionid').val() + '/';
}

const isGuest = () => {
    return $('#isguest').prop('checked');
}

const newSessionId = () => {
    return Math.floor((1 + Math.random()) * 0x1000000)
        .toString(16).substring(1);
}

const addLog = (msg) => {
    const date = (new Date()).toTimeString().slice(0, 8);
    $("#log").prepend(`<li>[${date}] ${msg}</li>`);
}