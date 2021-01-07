import moment from 'moment';

export function secondsToTimestamp(seconds) {    //formats seconds into mm:ss if less than an hour, hh:mm:ss if greater than an hour
	const posSeconds = Math.abs(seconds);
	const timeString = new Date(posSeconds * 1000).toISOString();
	const subTimeString = posSeconds >= 3600 ? timeString.substr(11, 8) : timeString.substr(14, 5);
	return seconds < 0 ? "-" + subTimeString : subTimeString;
}

export function calculateCurrentPosition(start_time, now_time, offset) {
	return offset + moment(now_time).diff(start_time, "seconds");
}

export function timestampToSeconds(timestamp) {
	if (!timestamp) {
		throw new Error("Invalid timestamp");
	}
	let spl = timestamp.split(":").map(i => parseInt(i)).reverse();
	if (spl.length > 3 || spl.length === 0) {
		throw new Error("Invalid timestamp");
	}
	let seconds = 0;
	for (let i = 0; i < spl.length; i++) {
		seconds += spl[i] * Math.pow(60, i);
	}
	return seconds;
}
