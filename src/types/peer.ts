import Peer, { DataConnection, MediaConnection } from "peerjs";

export interface PeerConnection {
    peer : Peer;
    mediaConnection : Map<string, MediaConnection>;
    dataConnection : Map<string, DataConnection>
    localStream? : MediaConnection ;
    screenStream :MediaConnection
}

export interface PeerData {
    type : 'chat' | 'system' | 'media-control' | 'user-info'
    payload : any ;
    timestamp : Date ;
    senderId: string
}