export interface User {
    id: string;
    name : string;
    avatar? : string;
    isHost : boolean;
    settings : {
        audioEnabled : boolean;
        videoEnabled : boolean;
        notificationEnabled : boolean;
    }
}