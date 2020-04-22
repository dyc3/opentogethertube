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
