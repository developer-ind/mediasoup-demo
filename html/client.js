const mediasoupClient = require("mediasoup-client");
const { ROUTES } = require('../routes');

var localCam;
var localScreen;
var sendTransport;
var recvTransport;
const device = new mediasoupClient.Device();
let producer;
let allProducers = [];
let consumers = [null, null, null];
$(document).ready(function () {
    window.onunload = async function () {
        if (sendTransport) {
            await sendTransport.close();
            await httpPostRequest(ROUTES.STOP_PRODUCER, {
                id: producer
            })
        }
    }
    loadDevice()
        .then(({ routerRtpCapabilities }) => {
            device.load({ routerRtpCapabilities })
        })
    $('#start').one('click', async function () {
        $('#start').attr('disabled', true);
        $('#sharescreen').attr('disabled', true);
        if (!device.loaded) {
            console.log("Not loaded");
            return;
        }
        await startCamera();
        createTransport('send')
            .then((res) => {
                if (!device.canProduce('video')) {
                    console.log("Device can't produce video")
                }
                // return sendTransport.produce({
                //     track: localCam.getVideoTracks()[0],
                //     encodings: camEncodings(),
                // });
            })
            .then((res) => {
                addLocalVideo('startcamera');
            })
            .catch((err) => console.error("Error in produce video: ", err.message, sendTransport))
            .then(() => {
                $('#subscribe').removeClass("d-none");
                $('#start').attr('disabled', false);
                $('#start').html('Stop');
                $('#start').unbind("click");
                $('#start').bind("click", async function () {
                    window.location.reload();
                });

            })
    })
    $('#sharescreen').one('click', async function () {
        $('#sharescreen').attr('disabled', true);
        $('#start').attr('disabled', true);
        if (!device.loaded) {
            console.log("Not loaded");
            return;
        }
        await shareScreen();
        createTransport('send')
            .then((res) => {
                if (!device.canProduce('video')) {
                    console.log("Device can't produce video")
                }
                return sendTransport.produce({
                    track: localScreen.getVideoTracks()[0],
                    encodings: camEncodings(),
                });
            })
            .then((res) => {
                addLocalVideo('sharescreen');
            })
            .catch((err) => console.error("Error in produce video: ", err.message, sendTransport))
            .then(() => {
                $('#sharescreen').attr('disabled', false);
                $('#sharescreen').html('Stop');
                $('#sharescreen').unbind("click");
                $('#sharescreen').bind("click", async function () {
                    await sendTransport.close();
                    await httpPostRequest(ROUTES.STOP_PRODUCER, {
                        id: producer
                    })
                    window.location.reload();
                });

            })
    })
    $('#subscribe').one('click', async function () {
        if (!device.loaded) {
            console.log("Not loaded");
            return;
        }
        $('#subscribe').attr('disable', true);
        // await startCamera();
        return createTransport('recv')
            .then(() => getAllProducers())
            .then(() => {
                // updateConsumer();
                setInterval(async () => await updateConsumer(), 1000)
            })
            .then(() => {
                $('#subscribe').html('Stop');
                $('#subscribe').unbind('click');
                $('#subscribe').bind('click', function () {
                    window.location.reload();
                })
            })
    })
})

function loadDevice() {
    return httpPostRequest(ROUTES.JOIN_PEER, {})
        .then((res) => res.json())
}

async function startCamera() {
    localCam = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
    });
}

async function shareScreen() {
    localScreen = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
    });
}

function createTransport(mode) {
    let transport;
    return httpPostRequest(ROUTES.CREATE_TRANSPORT, {
        mode: mode
    })
        .then((res) => res.json())
        .then(({ transportOptions, created }) => {
            if (mode === 'send') {
                sendTransport = device.createSendTransport(transportOptions);
                transport = sendTransport;
            }
            else {
                recvTransport = device.createRecvTransport(transportOptions);
                transport = recvTransport;
            }
            transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
                httpPostRequest(ROUTES.CONNECT_TRANSPORT, {
                    mode: mode,
                    dtlsParameters
                })
                    .then(() => callback())
                    .then(() => errback())
            });
            if (mode === 'send') {
                transport.on('produce', async ({ kind, rtpParameters, appData },
                    callback, errback) => {
                    httpPostRequest(ROUTES.PRODUCE, {
                        kind,
                        rtpParameters,
                        transportId: transport.id
                    })
                        .then((res) => res.json())
                        .then(({ id }) => {
                            producer = id;
                            return callback({ id })
                        })
                        .then(() => errback())
                });
            }
            return transport;
        })
        .catch((err) => console.error("Error in creating transport: ", err.message))
}

function updateConsumer() {
    return Promise.resolve()
        .then(() => getAllProducers())
        .then(({ producerIds }) => {
            const extraProducers = producerIds.filter(p => !allProducers.includes(p));
            const exitProducers = allProducers.filter(a => !producerIds.includes(a));
            allProducers = [...producerIds];
            console.log("Consumers to remove: ", exitProducers);
            console.log("Consumers to add: ", extraProducers);
            exitProducers.forEach(async (producer) => {
                const consumer = consumers.filter(consumer => consumer.producerId === producer)[0];
                console.log("consume remove: ", consumer)
                if (consumer) {
                    await consumer.close();
                    const index = consumers.map(c => c.id).indexOf(consumer.id);
                    console.log("Index: ", consumers, index)
                    const videoEl = document.getElementById(`video-remote${index + 1}`)
                    console.log("Video eleemt: ", videoEl);
                    videoEl.srcObject = null;
                    consumers.splice(index, 1);
                }
            })
            extraProducers.forEach(async (producerId) => {
                await attachConsumer(producerId);
            })
        })
}
function attachConsumer(producerId) {
    return Promise.resolve()
        .then(() => httpPostRequest(ROUTES.CONSUME, {
            rtpCapabilities: device.rtpCapabilities,
            producerId: producerId
        }))
        .then(res => res.json())
        .then((res) => {
            return recvTransport.consume(res);
        })
        .then(async (consumer) => {
            consumers.push(consumer);
            await resumeConsumer(consumer);
            return consumer;
        })
        .then((consumer) => addVideo(consumer, consumers.length - 1))
}
function resumeConsumer(consumer) {
    return httpPostRequest(ROUTES.RESUME_CONSUMER, {
        id: consumer.id
    })
        .then(() => consumer.resume())
}

function getAllProducers() {
    return httpPostRequest(ROUTES.GET_ALL_PRODUCERS, {})
        .then(res => res.json())
}

function addLocalVideo(type) {
    const localstream = (type === 'sharescreen' ? localScreen : localCam)
    const track = localstream.getVideoTracks()[0];
    var videoElem = document.getElementById('video-local');
    videoElem.srcObject = new MediaStream([track]);
    videoElem.play();
}

function addVideo(consumer, i) {
    const { track } = consumer;
    console.log("Producer id : ", consumer.producerId, i);
    var videoElem = document.getElementById(`video-remote${i + 1}`);
    videoElem.srcObject = new MediaStream([track]);
    videoElem.play();
}

const CAM_VIDEO_SIMULCAST_ENCODINGS =
    [
        { maxBitrate: 96000, scaleResolutionDownBy: 4 },
        { maxBitrate: 680000, scaleResolutionDownBy: 1 },
    ];

function camEncodings() {
    return CAM_VIDEO_SIMULCAST_ENCODINGS;
}

function httpPostRequest(route, body) {
    return fetch(route, {
        method: "post",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    })
}

