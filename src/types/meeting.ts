export interface Participant {
  id: string;
  name: string 
  isAudioMuted : boolean;
  isVideoMuted : boolean;
  stream? : MediaStream;
  isScreenSharing : boolean;
  joinedAt: Date;
}


export interface ChatMessage {
  id: string;
  senderId: string;
  senderName : string;
  message : string;
  timestamp:  Date;
  type : "text"| "system";
}

export interface MeetingSettings {
  audioEnabled : boolean;
  videoEnabled : boolean;
  screenShareEnabled:boolean;
  chatEnabled: boolean;

}

export interface Meeting {
  id: string;
  name : string;
  participants : Participant[]
  messages : ChatMessage[]
  settings : MeetingSettings;
  createdAt : Date 
  isActive : boolean
}