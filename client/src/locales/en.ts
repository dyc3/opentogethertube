export default {
	"landing": {
		hero: {
			title: "Enjoy Together.",
			description:
				"Real-time syncronized playback. Optional voting system.\nDark theme. No sign up required. All Open Source.\nIt's never been easier to watch videos together.",
			btns: {
				create: "@:nav.create.title",
				browse: "Browse Rooms",
				source: "View Source",
			},
		},
		intro: {
			title: "Remote Watch Parties Just Got a Lot Easier",
			name: "OpenTogetherTube",
			text1: "is a real-time video syncronization platform.\nIt's easy to use and has no sign up required. Just create a room, add videos and\ninvite your friends. BOOM! You're ready to binge videos with your friends until 3AM.",
			text2: "The original TogetherTube was loved for it's simple interface,\nand how easy it was to start watching videos right away.\nOpenTogetherTube aims to be just as easy, and then improve on\ntop of that to make it even better.",
			text3: "Currently, you can watch online videos with your friends from Youtube, Vimeo, Dailymotion, direct links to .mp4 videos, and",
			link: "more are on the way",
		},
		features: {
			"title": "Core Features",
			"syncronized-playback": {
				title: "Syncronized Playback",
				text: "You hit play, and the video plays for everybody\nin the room. Simple as that.",
			},
			"permanent-rooms": {
				title: "Permanent Rooms",
				text: "You and the squad come here often? Avoid the hastle\nof sending out a new link every time. Permanent\nrooms get a custom url that doesn't change.",
			},
			"dark-theme": {
				title: "Dark Theme",
				text: "Watching Vine compilations late at night?\nOpenTogetherTube has a dark theme by default so\nyour eyes won't suffer.",
			},
			"room-permissions": {
				title: "Room Permissions",
				text: "Tired of random goofballs joining your room and\nadding lots of loud videos to your chill lofi hip-hop\nlistening session? Just block them from adding videos.",
			},
			"voting-system": {
				title: "Voting System",
				text: "Can't decide what to watch next? Switch the queue\nto the vote system and let democracy do what it\ndoes best.",
			},
			"playlist-copying": {
				title: "Playlist Copying",
				text: "Add entire playlists or channels to the video queue\nall at once so you don't have to sit there adding\neach video to the queue one by one. It's the best\nway to binge watch that new channel with your friends.",
			},
		},
		support: {
			title: "Support Development",
			description1:
				"OpenTogetherTube would not be possible without the help of contributors and supporters like you.",
			description2:
				"Get involved with development by contributing your ideas or code, or show your support by becoming a sponsor. All donations are used to pay for hosting costs, for the development of OpenTogetherTube, and to keep OpenTogetherTube ad-free.",
			how: "How Can I Help?",
			sponsor: "Become a Sponsor",
			contribute: "Contribute",
		},
	},
	"footer": {
		"disclaimer":
			"Disclaimer: The OpenTogetherTube project is not associated with TogetherTube nor Watch2Gether.",
		"made-in": "Made in America",
		"thanks-to": "Special Thanks to",
		"privacy-policy": "Privacy Policy",
		"attribution": "Attribution",
	},
	"not-found": {
		title: "Page Not Found",
		home: "@:nav.home",
		browse: "@:landing.hero.btns.browse",
	},
	"quick-room": {
		text: "Making a temporary room for you...",
	},
	"attribution": {
		"sponsorblock-text": "Uses SponsorBlock data from",
	},
	"faq": {
		title: "Frequently Asked Questions",
		questions: [
			{
				question: "What kind of videos can be played?",
				answer: "Youtube, Vimeo, and Dailymotion videos, as well as direct links to supported video files, like .mp4 (and sometimes .webm).",
			},
			{
				question: "Can you add support X?",
				answer: "If X has an iframe API, then yes, that is possible.",
			},
			{
				question: "Will you add support for X?",
				answer: "Maybe, it depends on demand. Add a github issue or upvote an existing one to express your interest.",
			},
			{
				question: "I want a permanent room with a custom URL.",
				answer: "Create one by clicking the button in the top right corner.",
			},
			{
				question:
					"Why do videos sometimes have no title or thumbnail, but they can still be played?",
				answer: "This probably means that the server was unable to get that information because it ran out of Youtube API quota.",
			},
			{
				question: 'Why does it say "Out of quota" when searching for youtube videos?',
				answer: "Youtube searches are expensive to perform. Because of this, searches are rate limted. If this happens, just do the search on youtube and copy the link.",
			},
			{
				question: "How do permanent rooms work?",
				answer: 'Right now, permanent rooms just serve to provide custom room URLs, and anybody can access all permanent rooms. If you are logged in, you can claim ownership of permanent rooms that have not been claimed. Eventually, rooms will be able to be set visibility as private, and only allow invited users into the room. This will require all invited users to have accounts, but it will prevent random or unwanted people from entering private rooms. Check the progress of private rooms here: <a href="https://github.com/dyc3/opentogethertube/issues/261">dyc3/opentogethertube#261</a>',
			},
		],
	},
	"nav": {
		"home": "Home",
		"browse": "Browse",
		"faq": "FAQ",
		"bug": "Report a Bug",
		"support": "Support Me!",
		"login": "Log In",
		"link-discord": "Link Discord",
		"logout": "Log Out",
		"create": {
			"title": "Create Room",
			"temp": "Create Temporary Room",
			"temp-desc": "Start watching videos with your friends ASAP.",
			"perm": "Create Permanent Room",
			"perm-desc": "Perfect for frequent visitors.",
		},
	},
	"room-list": {
		"no-rooms": "No rooms right now...",
		"create": "@:nav.create.title",
		"no-description": "No description.",
		"nothing-playing": "Nothing playing.",
	},
	"room": {
		"title-temp": "Temporary Room",
		"kick-me": "Kick me",
		"rewind": "Rewind 10s",
		"skip": "Skip 10s",
		"play-pause": "Play/Pause",
		"next-video": "Next video",
		"toggle-fullscreen": "Toggle fullscreen",
		"con-status": {
			"connecting": "Connecting...",
			"connected": "Connected",
			"failed": "Failed to join room",
			"find-another": "Find Another Room",
		},
		"tabs": {
			queue: "Queue",
			add: "Add",
			settings: "Settings",
		},
		"users": {
			title: "Users",
			set: "Set your name",
			empty: "There seems to be nobody else here. Invite some friends!",
			you: "You",
			demote: "Demote",
			promote: "Promote",
		},
	},
	"privacy": {
		title: "@:footer.privacy-policy",
		text1: "This site uses cookies. It also uses Google Analytics, but only the smallest subset of information is tracked. The only demographic information that is collected is country, and whether you are on desktop or mobile. The collected data is never associated with your OTT account or session. If you do not want this information collected, use an ad blocker.",
		text2: 'Your IP is not logged in OpenTogetherTube\'s logs. However, it is recorded for a short period of time for rate limiting.\nChats are not recorded. What you search for in the "add video" search box is never associated with your OTT account or session.',
		text3: "General site usage, like creating a room, adding videos, etc., are logged to monitor and debug performace. Logs are not kept for more than a week.\nLogged events are not associated with your account or session.",
		text4: "If you have registered an account, your email is only used for account recovery, or to contact you in case it is necessary to resolve a bug, or follow up on site feedback. An email is not required if you log in with Discord. Your email, owned rooms, or other account information is your private information, and as such will never be distributed or sold to third parties.",
		text5: {
			"text": "OpenTogetherTube is GDPR compliant because of how little information is collected. If, for some reason, you really want to have the one database row that represents your account, reach out to me",
			"link-text": "on twitter.",
		},
		text6: {
			"text1": "This site uses the Youtube Data API, and it's usage must comply with the",
			"link-text1": "YouTube API Terms of Service",
			"text2":
				"No personally identifiable information is sent to Youtube. Watching Youtube videos requires you to agree to the",
			"link-text2": "Youtube Terms of Service",
			"text3": "and",
			"link-text3": "Google's privacy policy",
		},
	},
	"chat": {
		"title": "Chat",
		"type-here": "Type your message here...",
	},
	"share-invite": {
		title: "Share Invite",
		text: "Copy this link and share it with your friends!",
		copied: "Copied!",
	},
	"video": {
		"add-explanation": "Add to the queue.",
		"playnow": "Play Now",
		"playnow-explanation":
			"Play this video now, pushing the current video to the top of the queue.",
		"no-video": "No video is playing.",
		"no-video-text": 'Click "Add" below to add a video.',
	},
	"add-preview": {
		"add-all": "Add All",
		"placeholder": "Type to search YouTube or enter a Video URL to add to the queue",
		"title": "What can I add?",
		"single-videos": "Single Videos",
		"playlists": "Playlists",
		"playlist": "Playlist",
		"text": "Or just type text to search Youtube.",
		"search": "Search",
		"search-for": 'Search YouTube for "{search}" by pressing enter, or by clicking search.',
		"platforms": {
			"youtube-videos": "Youtube videos: {url}",
			"vimeo-videos": "Vimeo videos: {url}",
			"dailymotion-videos": "Dailymotion videos: {url}",
			"any-mp4-videos": "Any public .mp4 videos: {url}",
			"youtube-playlists": "Youtube playlists: {url}",
			"youtube-channels": "Youtube channels: {url}",
			"subreddits": "Subreddits: {url}",
		},
		"messages": {
			"unknown-status": "Unknown status for add preview response: {status}.",
			"unknown-error": "An unknown error occurred when getting add preview. Try again later.",
			"failed-to-get-add-preview":
				"Failed to get add preview. This is probably a bug, check console for details.",
			"failed-to-all-videos": "Failed to all videos: {message}",
		},
	},
	"processed-text": {
		"link-hint": "Click to copy this link to the add tab.",
	},
	"video-queue": {
		"no-videos": "There aren't any videos queued up.",
		"add-video": "Add a video",
	},
	"video-queue-item": {
		"experimental": "Experimental support for this service! Expect it to break a lot.",
		"play-next": "Play Next",
		"play-last": "Play Last",
		"add": "Add",
		"remove": "Remove",
		"messages": {
			"video-added": "Video added",
			"video-removed": "Video removed",
		},
		"start-at": "Start at {timestamp}",
	},
	"room-settings": {
		"title": "@:create-room-form.title",
		"description": "@:create-room-form.description",
		"visibility": "@:create-room-form.visibility",
		"public": "@:create-room-form.public",
		"unlisted": "@:create-room-form.unlisted",
		"queue-mode": "@:create-room-form.queue-mode",
		"manual": "@:create-room-form.manual",
		"manual-hint":
			"Default normal behavior, works how you would expect it to. You can manually reorder items in the queue.",
		"vote": "@:create-room-form.vote",
		"vote-hint": "The highest voted video gets played next.",
		"loop": "Loop",
		"loop-hint": "When the video ends, put it at the end of the queue.",
		"dj": "DJ",
		"dj-hint":
			"When the video ends, start the same video from the beginning. Good for looping background music.",
		"auto-skip-text":
			"Auto-skip sponsored segments, intros, self-promos, etc. using SponsorBlock data.",
		"permissions-not-available": "Permissions are not available in temporary rooms.",
		"room-needs-owner": "This room needs an owner before permissions can be modified.",
		"login-to-claim": "Log in to claim this room.",
		"arent-able-to-modify-permissions": "You aren't able to modify permissions in this room.",
		"settings-applied": "Settings applied",
		"now-own-the-room": "You now own the room {room}.",
	},
	"create-room-form": {
		"card-title": "Create a Permanent Room",
		"create-room": "Create Room",
		"name": "Name",
		"name-hint": "Used in the room URL. Can't be changed later.",
		"title": "Title",
		"title-hint": "Optional",
		"description": "Description",
		"description-hint": "@:create-room-form.title-hint",
		"visibility": "Visibility",
		"visibility-hint": "Controls whether or not the room shows up in the room list.",
		"queue-mode": "Queue Mode",
		"manual": "Manual",
		"vote": "Vote",
		"public": "Public",
		"unlisted": "Unlisted",
		"rules": {
			"name": {
				"name-required": "Name is required",
				"no-spaces": "Name must not contain spaces.",
				"length": "Name must be between 3 and 32 characters",
				"alphanumeric":
					"Name must only contain alphanumeric characters, dashes, and underscores",
				"taken": "Name is already taken",
			},
			"invalid-visibility": "Invalid Visibility",
			"invalid-queue": "Invalid Queue Mode",
		},
		"unknown-error": "An unknown error occurred. Try again later.",
	},
	"login-form": {
		"login": "@:nav.login",
		"register": "Register",
		"login-discord": "Log in with Discord",
		"email": "Email",
		"username": "Username",
		"password": "Password",
		"retype-password": "Retype Password",
		"rules": {
			"email-required": "Email is required",
			"valid-email": "Must be a valid email",
			"username-required": "Username is required",
			"username-length": "Username must be between 1 and {length} characters",
			"password-required": "Password is required",
			"password-length": "Password must be at least 10 characters long",
			"retype-password": "Please retype your password",
			"passwords-match": "Passwords must match",
		},
		"errors": {
			"something-weird-happened":
				"Something weird happened, but you might be logged in? Refresh the page.",
			"login-failed-noserver":
				"Failed to log in, but the server didn't say why. Report this as a bug.",
			"login-failed": "Failed to log in, and I don't know why. Report this as a bug.",
			"register-failed-noserver":
				"Failed to register, but the server didn't say why. Report this as a bug.",
			"register-failed":
				"Failed to register, and I don't know why. Check the console and report this as a bug.",
			"in-use": "Already in use.",
		},
	},
	"permissions-editor": {
		"title": "Permissions Editor",
		"text1":
			"All permissions granted to less privileged users are automatically granted to more privileged users.",
		"text2":
			"Administrators are granted everything. Room owner is automatically Administrator, and can't be demoted.",
		"viewing-as": "Viewing as",
		"permission": "Permission",
	},
	"actions": {
		"cancel": "Cancel",
		"close-all": "Close All",
		"undo": "undo",
		"save": "Save",
	},
	"client-settings": {
		title: "Preferences",
		description: "These settings are saved in your browser, and only affect you.",
		activator: "@:client-settings.title",
	},
};
