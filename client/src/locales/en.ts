import { OttWebsocketError, BehaviorOption, Role } from "ott-common/models/types";

export default {
	"common": {
		"yes": "Yes",
		"no": "No",
		"ok": "OK",
		"cancel": "Cancel",
		"close": "Close",
		"close-all": "Close All",
		"add": "Add",
		"remove": "Remove",
		"delete": "Delete",
		"play": "Play",
		"pause": "Pause",
		"save": "Save",
		"search": "Search",
		"undo": "Undo",
		"copy": "Copy",
		"show": "Show",
		"hide": "Hide",
		"discard": "Discard",
		"loading": "Loading...",
		"view": "View",
		"restore": "Restore",
		"success": "Success",
	},
	"behavior": {
		[BehaviorOption.Always]: "Always",
		[BehaviorOption.Prompt]: "Prompt",
		[BehaviorOption.Never]: "Never",
	},
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
		"next-video-vote": "Vote to skip video",
		"toggle-fullscreen": "Toggle fullscreen",
		"con-status": {
			connecting: "Connecting...",
			connected: "Connected",
		},
		"tabs": {
			queue: "Queue",
			settings: "Settings",
		},
		"users": {
			title: "Users",
			set: "Set your name",
			empty: "There seems to be nobody else here. Invite some friends!",
			you: "You",
			demote: "Demote",
			promote: "Promote",
			kick: "Kick",
		},
	},
	"privacy": {
		title: "@:footer.privacy-policy",
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
		"search-for": 'Search YouTube for "{search}" by pressing enter, or by clicking search.',
		"platforms": {
			"youtube-videos": "Youtube videos: {url}",
			"vimeo-videos": "Vimeo videos: {url}",
			"dailymotion-videos": "Dailymotion videos: {url}",
			"any-mp4-videos": "Any public .mp4 videos: {url}",
			"youtube-playlists": "Youtube playlists: {url}",
			"youtube-channels": "Youtube channels: {url}",
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
		"export": "Export",
		"export-diag-title": "Export Queue",
		"export-hint": 'Copy and paste this text into the "Add" tab to restore this queue.',
		"restore": "Would you like to restore the videos from the previous queue?",
		"restore-queue": "Restore Queue?",
		"restore-queue-hint":
			"This is what was in the queue last time this room was active. Would you like to restore it?",
	},
	"video-queue-item": {
		"experimental": "Experimental support for this service! Expect it to break a lot.",
		"play-next": "Play Next",
		"play-last": "Play Last",
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
		"load-failed": "Failed to load room settings.",
		"restore-queue": "Restore the queue when the room is loaded",
		"enable-vote-skip": "Enable vote skip",
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
		"email-or-username": "Email or Username",
		"username": "Username",
		"password": "Password",
		"retype-password": "Retype Password",
		"email-optional":
			"Providing an email is optional, but makes it impossible to recover your account if you forget your password.",
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
		"change-password": {
			title: "Change Password",
			success: "Password change successful.",
			forgot: "Forgot your password?",
			prompt: "Enter the email address or the username associated with your account.",
			reset: "Reset",
			sent: "Password reset email sent.",
			failed: "Unable to reset password.",
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
	"client-settings": {
		"title": "Preferences",
		"description": "These settings are saved in your browser, and only affect you.",
		"activator": "@:client-settings.title",
		"room-layout": "Room Layout",
		"theme": "Theme",
		"sfx-enable": "Enable Sound Effects",
		"sfx-volume": "Sound Effect Volume",
	},
	"connect-overlay": {
		"title": "Disconnected",
		"find-another": "Find Another Room",
		"dc-reasons": {
			[OttWebsocketError.UNKNOWN]: "@:connect-overlay.dc-reasons.unknown",
			[OttWebsocketError.ROOM_NOT_FOUND]: "Room not found.",
			[OttWebsocketError.ROOM_UNLOADED]: "Room was unloaded.",
			[OttWebsocketError.MISSING_TOKEN]:
				"A token was not provided. Refresh the page and try again. Otherwise, please open an issue on GitHub.",
			[OttWebsocketError.KICKED]: "You were kicked from the room by a user.",
			unknown: "Something happened, but we don't know what. Please report this as a bug.",
		},
	},
	"vote-skip": {
		remaining: "{count} more votes to skip",
	},
	"roles": {
		[Role.Administrator]: "Administrator",
		[Role.Moderator]: "Moderator",
		[Role.TrustedUser]: "Trusted User",
		[Role.RegisteredUser]: "Registered User",
		[Role.UnregisteredUser]: "Unregistered User",
		[Role.Owner]: "Owner",
	},
	"errors": {
		BadPasswordError:
			"Password does not meet minimum requirements. Must be at least 8 characters long, and contain 2 of the following categories of characters: lowercase letters, uppercase letters, numbers, special characters.",
		BadApiArgumentException: "Bad API Argument. This is likely a bug, please report it.",
	},
	"player": {
		"buffer-warn": {
			spans: "You haven't buffered enough of the video yet. Current time ranges buffered: {ranges}",
		},
	},
};
