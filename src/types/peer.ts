import Peer, { DataConnection, MediaConnection } from "peerjs";

export interface PeerConnection {
    peer : Peer;
    mediaConnection : Map<string, MediaConnection>;
    dataConnection : Map<string, DataConnection>
    localStream? : MediaConnection ;
    screenStream :MediaConnection
}

export interface PeerData {
    type : 'chat' | 'system' | 'media-control' | 'user-info' | 'room-join' | 'room-call-request' |'room-join-ack' | 'call-request' | 'call-ack' | 'call-reject' | 'call-end' | 'call-cancel' | 'call-accept' | 'call-offer' | 'call-answer'; 
    payload : any ;
    timestamp : Date ;
    senderId: string
}