export default {
	"landing": {
		hero: {
			title: "Gemeinsam genießen.",
			description:
				"Synchrone Wiedergabe in Echtzeit. Optionales Abstimmungssystem.\nDunkles Theme. Keine Anmeldung erforderlich. Alles Open Source.\nNoch nie war es so einfach, gemeinsam Videos anzuschauen.",
			btns: {
				create: "@:nav.create.title",
				browse: "Räume durchsuchen",
				source: "Quellcode ansehen",
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
		title: "Seite nicht gefunden",
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
		"home": "Startseite",
		"browse": "Durchsuchen",
		"faq": "FAQ",
		"bug": "Einen Fehler melden",
		"support": "Spenden",
		"login": "Anmelden",
		"link-discord": "Link Discord",
		"logout": "Abmelden",
		"create": {
			"title": "Raum erstellen",
			"temp": "Temporären Raum erstellen",
			"temp-desc": "Start watching videos with your friends ASAP.",
			"perm": "Permanenten Raum erstellen",
			"perm-desc": "Perfect for frequent visitors.",
		},
	},
	"room-list": {
		"no-rooms": "Kein Raum im Moment...",
		"create": "@:nav.create.title",
		"no-description": "Keine Beschreibung.",
		"nothing-playing": "Nothing playing.",
	},
	"room": {
		"title-temp": "Temporärer Raum",
		"kick-me": "Kick me",
		"rewind": "10s Zurückspulen",
		"skip": "10s Vorspulen",
		"play-pause": "Wiedergabe/Pause",
		"next-video": "Nächstes Video",
		"toggle-fullscreen": "Vollbild umschalten",
		"con-status": {
			"connecting": "Verbinden...",
			"connected": "Verbunden",
			"failed": "Verbindung zum Raum fehlgeschlagen",
			"find-another": "Einen anderen Raum finden",
		},
		"tabs": {
			queue: "Warteschlange",
			add: "Hinzufügen",
			settings: "Einstellungen",
		},
		"users": {
			"title": "Nutzer",
			"set": "Set your name",
			"empty": "Es scheint niemand sonst hier zu sein. Lade ein paar Freunde ein!",
			"waiting-for-permissions": "Waiting for permissions metadata...",
			"you": "Du",
			"demote": "degradieren",
			"promote": "befördern",
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
		"type-here": "Schreibe deine Nachricht hier...",
	},
	"share-invite": {
		title: "Einladung zum Teilen",
		text: "Kopieren Sie diesen Link und teilen Sie ihn mit Ihren Freunden!",
		copied: "Kopiert!",
	},
	"video": {
		"add-explanation": "Zur Warteschlange hinzufügen.",
		"playnow": "Jetzt abspielen",
		"playnow-explanation":
			"Dieses Video jetzt abspielen, wobei das aktuelle Video an den Anfang der Warteschlange gestellt wird.",
		"no-video": "Es wird kein Video abgespielt.",
		"no-video-text": 'Klicken Sie unten auf "Hinzufügen", um ein Video hinzuzufügen.',
	},
	"add-preview": {
		"add-all": "Alle hinzufügen",
		"placeholder": "Type to search YouTube or enter a Video URL to add to the queue",
		"title": "What can I add?",
		"single-videos": "Einzelne Videos",
		"playlists": "Wiedergabelisten",
		"playlist": "Wiedergabeliste",
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
		"no-videos": "Es sind keine Videos in der Warteschlange.",
		"add-video": "Ein Video hinzufügen",
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
		"loop": "Schleife",
		"loop-hint": "When the video ends, put it at the end of the queue.",
		"dj": "DJ",
		"dj-hint":
			"When the video ends, start the same video from the beginning. Good for looping background music.",
		"auto-skip-text":
			"Auto-skip sponsored segments, intros, self-promos, etc. using SponsorBlock data.",
		"permissions-not-available": "In temporären Räumen sind keine Berechtigungen verfügbar.",
		"room-needs-owner": "Dieser Raum braucht einen Eigentümer, bevor die Berechtigungen geändert werden können.",
		"login-to-claim": "Melden Sie sich an, um diesen Raum zu beanspruchen.",
		"arent-able-to-modify-permissions": "Sie können die Berechtigungen in diesem Raum nicht ändern.",
		"settings-applied": "Einstellungen angewendet",
		"now-own-the-room": "Der Raum {room} gehört jetzt Ihnen.",
	},
	"create-room-form": {
		"card-title": "Permanenten Raum erstellen",
		"create-room": "Raum erstellen",
		"name": "Name",
		"name-hint": "Wird in der Raum-URL verwendet. Kann später nicht mehr geändert werden.",
		"title": "Titel",
		"title-hint": "Optional",
		"description": "Beschreibung",
		"description-hint": "@:create-room-form.title-hint",
		"visibility": "Sichtbarkeit",
		"visibility-hint": "Steuert, ob der Raum in der Raumliste angezeigt wird oder nicht.",
		"queue-mode": "Warteschlangen-Modus",
		"manual": "Manuell",
		"vote": "Abstimmen",
		"public": "Öffentlich",
		"unlisted": "Ungelistet",
		"rules": {
			"name": {
				"name-required": "Name ist erforderlich",
				"no-spaces": "Name darf keine Leerzeichen enthalten.",
				"length": "Der Name muss zwischen 3 und 32 Zeichen lang sein.",
				"alphanumeric":
					"Der Name darf nur alphanumerische Zeichen, Bindestriche und Unterstriche enthalten.",
				"taken": "Name ist bereits vergeben",
			},
			"invalid-visibility": "Ungültige Sichtbarkeit",
			"invalid-queue": "Ungültiger Warteschlangen-Modus",
		},
		"unknown-error": "Ein unbekannter Fehler ist aufgetreten. Versuchen Sie es später noch einmal.",
	},
	"login-form": {
		"login": "@:nav.login",
		"register": "Registrieren",
		"login-discord": "Anmelden mit Discord",
		"email": "E-Mail",
		"username": "Nutzername",
		"password": "Passwort",
		"retype-password": "Passwort erneut eingeben",
		"rules": {
			"email-required": "E-Mail ist erforderlich",
			"valid-email": "Es muss eine gültige E-Mail sein",
			"username-required": "Nutzername ist erforderlich",
			"username-length": "Der Nutzername muss zwischen 1 und {length} Zeichen haben",
			"password-required": "Passwort ist erforderlich",
			"password-length": "Das Passwort muss mindestens 10 Zeichen lang sein",
			"retype-password": "Bitte geben Sie Ihr Passwort erneut ein",
			"passwords-match": "Passwörter müssen übereinstimmen",
		},
		"errors": {
			"something-weird-happened":
				"Es ist etwas Seltsames passiert, aber vielleicht sind Sie eingeloggt? Aktualisieren Sie die Seite.",
			"login-failed-noserver":
				"Failed to log in, but the server didn't say why. Report this as a bug.",
			"login-failed": "Failed to log in, and I don't know why. Report this as a bug.",
			"register-failed-noserver":
				"Failed to register, but the server didn't say why. Report this as a bug.",
			"register-failed":
				"Failed to register, and I don't know why. Check the console and report this as a bug.",
			"in-use": "Bereits in Verwendung.",
		},
	},
	"permissions-editor": {
		"title": "Berechtigungs-Editor",
		"text1":
			"Alle Berechtigungen, die weniger privilegierten Benutzern gewährt werden, werden automatisch auch den höher privilegierten Benutzern gewährt.",
		"text2":
			"Administratoren haben alle Rechte. Der Raumbesitzer ist automatisch Administrator und kann nicht degradiert werden.",
		"viewing-as": "Ansicht als",
		"permission": "Berechtigung",
	},
	"actions": {
		"cancel": "Abbrechen",
		"close-all": "Alle schließen",
		"undo": "Rückgängig",
		"save": "Speichern",
	},
};
