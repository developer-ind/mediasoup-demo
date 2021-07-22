#!/bin/bash

function finish() {
    res=$(curl -X POST -H "Content-Type: application/json" -d '{"id":'$producer_id'}' "http://localhost:3000/stop-producer")
    echo "Bye,bye"
}

trap finish SIGINT

result=$(curl -X GET --header "Accept: */*" "http://localhost:3000/create-direct-transport") 

rtp_port=$(echo $result | jq '.rtp') 
rtpc_port=$(echo $result | jq '.rtcp') 
producer_id=$(echo $result | jq '.id')
media_pathname=$1

ffmpeg   -re   -v info   -stream_loop -1   -i $media_pathname -map 0:a:0   -acodec libopus -ab 128k -ac 2 -ar 48000   -map 0:v:0   -pix_fmt yuv420p -c:v libvpx -b:v 1000k -deadline realtime -cpu-used 4   -f tee   "[select=v:f=rtp:ssrc=22222222:payload_type=102]rtp://127.0.0.1:"+$rtp_port+"?rtcpport="+$rtpc_port
