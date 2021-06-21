const express = require("express");
const cors = require("cors");
var mediasoup = require("mediasoup");
const { ROUTES } = require("./routes");
const app = express();

const PORT = 3000;
let router1;
let sendTransport;
let recvTransport;
let producers = [];
let consumers = [];
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('html'));
const mediaCodecs = [
    {
        kind: "audio",
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2,
    },
    {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
        parameters: {
            //                'x-google-start-bitrate': 1000
        },
    },
    {
        kind: "video",
        mimeType: "video/h264",
        clockRate: 90000,
        parameters: {
            "packetization-mode": 1,
            "profile-level-id": "4d0032",
            "level-asymmetry-allowed": 1,
            //						  'x-google-start-bitrate'  : 1000
        },
    },
    {
        kind: "video",
        mimeType: "video/h264",
        clockRate: 90000,
        parameters: {
            "packetization-mode": 1,
            "profile-level-id": "42e01f",
            "level-asymmetry-allowed": 1,
            //						  'x-google-start-bitrate'  : 1000
        },
    },
]
app.listen(PORT, () => {
    mediasoup.createWorker()
        .then((worker) => worker.createRouter({ mediaCodecs }))
        .then((router) => router1 = router)
        .then(() => console.log("Router created"))
        .catch((e) => console.error("Error in created router: ", e.message))
    console.log("App is listening to port: ", PORT);
})

app.post(ROUTES.JOIN_PEER, (req, res) => {
    res.send({ routerRtpCapabilities: router1.rtpCapabilities })
})

app.post(ROUTES.CREATE_TRANSPORT, async (req, res) => {
    const { mode } = req.body;
    console.log("Mode is: ", mode);
    const transport = await router1.createWebRtcTransport({
        listenIps: [
            { ip: "127.0.0.1", announcedIp: null },
        ],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true
    });
    if (mode === 'send') {
        sendTransport = transport;
    }
    else {
        recvTransport = transport;
    }
    let { id, iceParameters, iceCandidates, dtlsParameters } = transport;
    res.send({ transportOptions: { id, iceParameters, iceCandidates, dtlsParameters } })
})

app.post(ROUTES.CONNECT_TRANSPORT, async (req, res) => {
    const { mode, dtlsParameters } = req.body;
    const transport = (mode === 'send' ? sendTransport : recvTransport);
    console.log("transport: ",transport)
    try {
        await transport.connect({ dtlsParameters });
    } catch (error) {
        console.log("errors: ", error)
    }
    res.send({ connected: true });
})

app.post(ROUTES.PRODUCE, async (req, res) => {
    const { kind,
        rtpParameters,
        transportId } = req.body;
    const producer = await sendTransport.produce({
        kind,
        rtpParameters,
    });
    producers.push(producer);
    res.send({ id: producer.id })
})

app.post(ROUTES.CONSUME, async (req, res) => {
    const { rtpCapabilities, producerId } = req.body;
    const consumer = await recvTransport.consume({
        producerId: producerId,
        rtpCapabilities,
    });

    consumers.push(consumer);
    res.send({
        producerId: consumer.producerId,
        id: consumer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        type: consumer.type,
    })
})

app.post(ROUTES.RESUME_CONSUMER, async (req, res) => {
    const { id } = req.body;
    await consumers.filter(consumer => consumer.id === id)[0].resume();
    res.send({
        resumed: true
    })
})

app.post(ROUTES.GET_ALL_PRODUCERS, (req, res) => {
    res.send({
        producerIds: producers.map(producer => producer.id)
    })
})

app.post(ROUTES.STOP_PRODUCER, async (req, res) => {
    const { id } = req.body;
    await producers.filter(producer => producer.id === id)[0].close();
    const index = producers.indexOf(id);
    producers.splice(index, 1);
    res.send({
        closed: true
    })
})