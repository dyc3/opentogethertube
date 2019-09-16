
export default function convertSecondstoHHMMSS(seconds){    //if the time passed to it is less than an hour, it converts to mm:ss instead
    let timeString = new Date(seconds * 1000).toISOString();
    return seconds >= 3600 ? timeString.substr(11,8) : timeString.substr(14,5);
}
