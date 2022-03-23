export default {
	"landing": {
		hero: {
			title: "Gemeinsam genießen.",
			description:
				"Synchrone Wiedergabe in Echtzeit. Optionales Abstimmungssystem.\nDunkles Theme. Keine Anmeldung erforderlich. Alles Open Source.\nNoch nie war es so einfach, gemeinsam Videos anzuschauen.",
			btns: {
				browse: "Räume durchsuchen",
				source: "Quellcode ansehen",
			},
		},
	},
	"not-found": {
		title: "Seite nicht gefunden",
	},
	"nav": {
		"home": "Startseite",
		"browse": "Durchsuchen",
		"faq": "FAQ",
		"bug": "Einen Fehler melden",
		"support": "Spenden",
		"login": "Anmelden",
		"logout": "Abmelden",
		"create": {
			"title": "Raum erstellen",
			"temp": "Temporären Raum erstellen",
			"perm": "Permanenten Raum erstellen",
		},
	},
	"room-list": {
		"no-rooms": "Kein Raum im Moment...",
		"no-description": "Keine Beschreibung.",
	},
	"room": {
		"title-temp": "Temporärer Raum",
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
			"empty": "Es scheint niemand sonst hier zu sein. Lade ein paar Freunde ein!",
			"you": "Du",
			"demote": "degradieren",
			"promote": "befördern",
		},
	},
	"chat": {
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
		"single-videos": "Einzelne Videos",
		"playlists": "Wiedergabelisten",
		"playlist": "Wiedergabeliste",
	},
	"video-queue": {
		"no-videos": "Es sind keine Videos in der Warteschlange.",
		"add-video": "Ein Video hinzufügen",
	},
	"room-settings": {
		"loop": "Schleife",
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
		"name-hint": "Wird in der Raum-URL verwendet. Kann später nicht mehr geändert werden.",
		"title": "Titel",
		"title-hint": "Optional",
		"description": "Beschreibung",
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
