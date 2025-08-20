import { BehaviorOption, OttWebsocketError, Role } from "ott-common/models/types";

export default {
	common: {
		yes: "Ja",
		no: "Nein",
		ok: "OK",
		cancel: "Abbrechen",
		close: "Schließen",
		"close-all": "Alle schließen",
		add: "Hinzufügen",
		remove: "Entfernen",
		delete: "Löschen",
		play: "Play",
		pause: "Pause",
		save: "Speichern",
		search: "Suche",
		undo: "Rückgängig",
		copy: "Kopieren",
		show: "Anzeigen",
		hide: "Ausblenden",
		discard: "Verwerfen",
		loading: "Laden...",
		view: "Ansicht",
		restore: "Wiederherstellen",
		success: "Erfolg",
		vote: "Abstimmen",
		unvote: "Abwahl",
		on: "Ein",
		off: "Aus",
		dismiss: "Entlassen",
		errors: {
			"rate-limit":
				"Rate-Limit überschritten. Bitte versuchen Sie es in {duration} Sekunden erneut.",
		},
	},
	behavior: {
		[BehaviorOption.Always]: "Immer",
		[BehaviorOption.Prompt]: "Nachfragen",
		[BehaviorOption.Never]: "Niemals",
	},
	landing: {
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
			title: "Watch-Partys aus der Ferne sind jetzt viel einfacher",
			name: "OpenTogetherTube",
			text1: "ist eine Plattform zur Echtzeit-Videosynchronisation. Es ist einfach zu bedienen und erfordert keine Anmeldung. Erstelle einfach einen Raum, füge Videos hinzu und lade deine Freunde ein. Zack, fertig! Du bist nun startklar um mit deinen Freunden bis 3 Uhr nachts Videos zu gucken.",
			text2: "Das ursprüngliche TogetherTube wurde für seine einfache Benutzeroberfläche geliebt und dafür, wie einfach es war, sofort mit dem Ansehen von Videos zu beginnen. OpenTogetherTube hat sich zum Ziel gesetzt, genauso einfach zu sein und es darüber hinaus noch besser zu machen.",
			text3: "Derzeit können Sie mit Ihren Freunden Online-Videos von Youtube, Vimeo, und direkte Links zu .mp4-Videos ansehen.",
			link: "Unterstützung für weitere Plattformen ist geplant",
		},
		features: {
			title: "Kernfunktionen",
			"synchronized-playback": {
				title: "Synchrone Wiedergabe",
				text: 'Sie drücken auf "Wiedergabe", und das Video wird für alle im Raum abgespielt. So einfach ist das.',
			},
			"permanent-rooms": {
				title: "Permanente Räume",
				text: "Sie und Ihre Truppe kommen oft hierher? Sparen Sie sich die Mühe, jedes Mal einen neuen Link zu verschicken. Permanente Räume erhalten eine benutzerdefinierte Url, die sich nicht ändert.",
			},
			"dark-theme": {
				title: "Dunkles Theme",
				text: "Schauen Sie sich Vine-Compilations spät in der Nacht an? OpenTogetherTube hat standardmäßig ein dunkles Theme, so dass Ihre Augen nicht leiden werden.",
			},
			"room-permissions": {
				title: "Raum-Berechtigungen",
				text: "Hast du es satt, dass irgendwelche Spaßvögel deinen Raum betreten und deine entspannte Lofi-Hip-Hop-Hörsession mit lauten Videos stören? Sperren Sie sie einfach für das Hinzufügen von Videos.",
			},
			"voting-system": {
				title: "Abstimmungssystem",
				text: "Sie können sich nicht entscheiden, was Sie als Nächstes sehen wollen? Schalten Sie die Warteschlange auf das Abstimmungssystem um und lassen Sie die Demokratie tun, was sie am besten kann.",
			},
			"playlist-copying": {
				title: "Ganze Wiedergabelisten und Kanäle abspielen",
				text: "Fügen Sie der Video-Warteschlange ganze Wiedergabelisten oder Kanäle auf einmal hinzu, damit Sie nicht jedes Video einzeln in die Warteschlange hinzufügen müssen.",
			},
		},
		support: {
			title: "Entwicklung unterstützen",
			description1:
				"OpenTogetherTube wäre ohne die Hilfe von Mitwirkenden und Unterstützern wie Ihnen nicht möglich.",
			description2:
				"Beteiligen Sie sich an der Entwicklung, indem Sie Ihre Ideen oder Ihren Code beisteuern, oder zeigen Sie Ihre Unterstützung, indem Sie Spender werden. Alle Spenden werden verwendet, um die Betriebskosten und die Entwicklung von OpenTogetherTube zu finanzieren und um OpenTogetherTube werbefrei zu halten.",
			how: "Wie kann ich helfen?",
			sponsor: "@:nav.support",
			contribute: "Beitragen",
		},
	},
	footer: {
		disclaimer:
			"Disclaimer: Das OpenTogetherTube-Projekt ist weder mit TogetherTube noch mit Watch2Gether verbunden.",
		"made-in": "Made in Amerika",
		"thanks-to": "Besonderen Dank an",
		"privacy-policy": "Datenschutzbestimmungen",
		attribution: "Zuschreibung",
	},
	"not-found": {
		title: "Seite nicht gefunden",
		home: "@:nav.home",
		browse: "@:landing.hero.btns.browse",
	},
	"quick-room": {
		text: "Erstelle einen temporären Raum für Sie...",
	},
	attribution: {
		"sponsorblock-text": "Verwendet SponsorBlock-Daten von",
	},
	nav: {
		home: "Startseite",
		browse: "Durchsuchen",
		"my-rooms": "Meine Räume",
		faq: "FAQ",
		bug: "Einen Fehler melden",
		support: "Unterstütze mich!",
		login: "Anmelden",
		"link-discord": "Mit Discord verknüpfen",
		logout: "Abmelden",
		create: {
			title: "Raum erstellen",
			temp: "Temporären Raum erstellen",
			"temp-desc": "Beginnen Sie sofort damit, Videos mit Ihren Freunden anzusehen.",
			perm: "Permanenten Raum erstellen",
			"perm-desc": "Ideal für häufige Besucher.",
		},
	},
	"my-rooms": {
		"confirm-delete":
			'Raum "{name}" dauerhaft löschen? Dies kann nicht rückgängig gemacht werden.',
	},
	"room-list": {
		"no-rooms": "Kein Raum im Moment...",
		create: "@:nav.create.title",
		"no-description": "Keine Beschreibung.",
		"nothing-playing": "Es wird nichts abgespielt.",
	},
	room: {
		"title-temp": "Temporärer Raum",
		"kick-me": "Mich rauswerfen",
		rewind: "10s Zurückspulen",
		skip: "10s Vorspulen",
		"play-pause": "Wiedergabe/Pause",
		"next-video": "Nächstes Video",
		"next-video-vote": "Für Video überspringen abstimmen",
		"toggle-fullscreen": "Vollbild umschalten",
		"con-status": {
			connecting: "Verbinden...",
			connected: "Verbunden",
		},
		tabs: {
			queue: "Warteschlange",
			settings: "Einstellungen",
		},
		users: {
			title: "Nutzer",
			set: "Geben Sie Ihren Nutzernamen ein",
			empty: "Es scheint niemand sonst hier zu sein. Lade ein paar Freunde ein!",
			you: "Du",
			demote: "degradieren",
			promote: "befördern",
			kick: "Rauswerfen",
		},
	},
	privacy: {
		title: "@:footer.privacy-policy",
	},
	chat: {
		title: "Chat",
		"type-here": "Schreibe deine Nachricht hier...",
	},
	"share-invite": {
		title: "Einladung zum Teilen",
		text: "Kopieren Sie diesen Link und teilen Sie ihn mit Ihren Freunden!",
		copied: "Kopiert!",
	},
	video: {
		"add-explanation": "Zur Warteschlange hinzufügen.",
		playnow: "Jetzt abspielen",
		"playnow-explanation":
			"Dieses Video jetzt abspielen, wobei das aktuelle Video an den Anfang der Warteschlange gestellt wird.",
		"no-video": "Es wird kein Video abgespielt.",
		"no-video-text": 'Klicken Sie unten auf "Hinzufügen", um ein Video hinzuzufügen.',
	},
	"add-preview": {
		label: "Link oder Suche",
		"add-all": "Alle hinzufügen",
		placeholder:
			"Geben Sie hier einen Suchbegriff ein um YouTube zu durchsuchen, oder geben Sie eine Video-URL ein, um sie zur Warteschlange hinzuzufügen.",
		title: "Was kann ich hinzufügen?",
		"single-videos": "Einzelne Videos",
		playlists: "Wiedergabelisten",
		playlist: "Wiedergabeliste",
		text: "Oder geben Sie einfach Text ein, um Youtube zu durchsuchen.",
		"search-for":
			'Suchen Sie auf YouTube nach "{search}", indem Sie die Eingabetaste drücken oder auf Suchen klicken.',
		platforms: {
			"youtube-videos": "Youtube-Videos: {url}",
			"vimeo-videos": "Vimeo-Videos: {url}",
			"any-mp4-videos": "Alle öffentlichen .mp4-Videos: {url}",
			"youtube-playlists": "Youtube-Wiedergabelisten: {url}",
			"youtube-channels": "Youtube-Kanäle: {url}",
		},
		messages: {
			"unknown-status": "Unbekannter Status für Vorschau-Antwort: {status}.",
			"unknown-error":
				"Ein unbekannter Fehler ist beim Laden der Vorschau aufgetreten. Versuchen Sie es später erneut.",
			"failed-to-get-add-preview":
				"Fehler beim Laden der Vorschau. Dies ist wahrscheinlich ein Bug, überprüfen Sie die Konsole für Details.",
			"failed-to-all-videos": "Fehler beim Hinzufügen aller Videos: {message}",
		},
	},
	"processed-text": {
		"link-hint":
			'Klicken Sie auf den Link, um ihn in die Registerkarte "Hinzufügen" zu übertragen.',
	},
	"video-queue": {
		"no-videos": "Es sind keine Videos in der Warteschlange.",
		"add-video": "Ein Video hinzufügen",
		export: "Exportieren",
		"export-diag-title": "Warteschlange exportieren",
		"export-hint":
			'Kopieren Sie diesen Text und fügen Sie ihn in das "Hinzufügen"-Tab ein, um diese Warteschlange wiederherzustellen.',
		restore: "Möchten Sie die Videos aus der vorherigen Warteschlange wiederherstellen?",
		"restore-queue": "Warteschlange wiederherstellen?",
		"restore-queue-hint":
			"Das war das letzte Mal in der Warteschlange, als dieser Raum aktiv war. Möchten Sie es wiederherstellen?",
	},
	"video-queue-item": {
		experimental:
			"Experimentelle Unterstützung für diesen Dienst! Rechnen Sie damit, dass er oft kaputt geht.",
		"play-next": "Als nächstes abspielen",
		"play-last": "Als letztes abspielen",
		messages: {
			"video-added": "Video hinzugefügt",
			"video-removed": "Video entfernt",
		},
		"start-at": "Starten bei {timestamp}",
	},
	"room-settings": {
		title: "@:create-room-form.title",
		description: "@:create-room-form.description",
		visibility: "@:create-room-form.visibility",
		public: "@:create-room-form.public",
		unlisted: "@:create-room-form.unlisted",
		"queue-mode": "@:create-room-form.queue-mode",
		manual: "@:create-room-form.manual",
		"manual-hint":
			"Standardverhalten, funktioniert so, wie man es erwarten würde. Sie können Einträge in der Warteschlange manuell neu anordnen.",
		vote: "@:common.vote",
		"vote-hint": "Das Video mit den meisten Stimmen wird als nächstes abgespielt.",
		loop: "Schleife",
		"loop-hint": "Wenn ein Video endet, wird es an das Ende der Warteschlange geschoben.",
		dj: "DJ",
		"dj-hint":
			"Wenn das Video endet, startet das gleiche Video von Anfang an. Gut für das Abspielen von Hintergrundmusik.",
		"auto-skip-text":
			"Unerwünschte Videosegmente automatisch überspringen mit SponsorBlock-Daten.",
		"auto-skip-text-sponsor": "Sponsor",
		"auto-skip-text-intro": "Intro",
		"auto-skip-text-outro": "Outro",
		"auto-skip-text-interaction": "Interaktion",
		"auto-skip-text-selfpromo": "Eigenwerbung",
		"auto-skip-text-music_offtopic": "Musik abseits des Themas",
		"auto-skip-text-preview": "Vorschau",
		"permissions-not-available": "In temporären Räumen sind keine Berechtigungen verfügbar.",
		"room-needs-owner":
			"Dieser Raum braucht einen Eigentümer, bevor die Berechtigungen geändert werden können.",
		"login-to-claim": "Melden Sie sich an, um diesen Raum zu beanspruchen.",
		"arent-able-to-modify-permissions":
			"Sie können die Berechtigungen in diesem Raum nicht ändern.",
		"settings-applied": "Einstellungen angewendet",
		"now-own-the-room": "Der Raum {room} gehört jetzt Ihnen.",
		"load-failed": "Fehler beim Laden der Raumeinstellungen.",
		"restore-queue": "Warteschlange beim Laden des Raums wiederherstellen",
		"enable-vote-skip": "Abstimmung zum Überspringen aktivieren",
	},
	"create-room-form": {
		"card-title": "Permanenten Raum erstellen",
		"create-room": "Raum erstellen",
		name: "Name",
		"name-hint": "Wird in der Raum-URL verwendet. Kann später nicht mehr geändert werden.",
		title: "Titel",
		"title-hint": "Optional",
		description: "Beschreibung",
		"description-hint": "@:create-room-form.title-hint",
		visibility: "Sichtbarkeit",
		"visibility-hint": "Steuert, ob der Raum in der Raumliste angezeigt wird oder nicht.",
		"queue-mode": "Warteschlangen-Modus",
		manual: "Manuell",
		vote: "@:common.vote",
		loop: "@:room-settings.loop",
		dj: "@:room-settings.dj",
		public: "Öffentlich",
		unlisted: "Ungelistet",
		rules: {
			name: {
				"name-required": "Name ist erforderlich",
				"no-spaces": "Name darf keine Leerzeichen enthalten.",
				length: "Der Name muss zwischen 3 und 32 Zeichen lang sein.",
				alphanumeric:
					"Der Name darf nur alphanumerische Zeichen, Bindestriche und Unterstriche enthalten.",
				taken: "Name ist bereits vergeben",
			},
			"invalid-visibility": "Ungültige Sichtbarkeit",
			"invalid-queue": "Ungültiger Warteschlangen-Modus",
		},
		"unknown-error":
			"Ein unbekannter Fehler ist aufgetreten. Versuchen Sie es später noch einmal.",
	},
	"login-form": {
		login: "@:nav.login",
		register: "Registrieren",
		"login-discord": "Anmelden mit Discord",
		email: "E-Mail",
		"email-or-username": "E-Mail oder Nutzername",
		username: "Nutzername",
		password: "Passwort",
		"retype-password": "Passwort erneut eingeben",
		"email-optional":
			"Optional. Die Angabe einer E-Mail macht es möglich, Ihr Konto wiederherzustellen, falls Sie Ihr Passwort vergessen.",
		rules: {
			"email-required": "E-Mail ist erforderlich",
			"valid-email": "Es muss eine gültige E-Mail sein",
			"username-required": "Nutzername ist erforderlich",
			"username-length": "Der Nutzername muss zwischen 1 und {length} Zeichen haben",
			"password-required": "Passwort ist erforderlich",
			"password-length": "Das Passwort muss mindestens 10 Zeichen lang sein",
			"retype-password": "Bitte geben Sie Ihr Passwort erneut ein",
			"passwords-match": "Passwörter müssen übereinstimmen",
		},
		errors: {
			"something-weird-happened":
				"Es ist etwas Seltsames passiert, aber vielleicht sind Sie eingeloggt? Aktualisieren Sie die Seite.",
			"login-failed-noserver":
				"Die Anmeldung ist fehlgeschlagen, aber der Server hat nicht gesagt, warum. Melden Sie dies als Fehler.",
			"login-failed":
				"Anmeldung fehlgeschlagen und ich weiß nicht warum. Melden Sie dies als Fehler.",
			"register-failed-noserver":
				"Die Registrierung ist fehlgeschlagen, aber der Server hat nicht gesagt, warum. Melden Sie dies als Fehler.",
			"register-failed":
				"Die Registrierung ist fehlgeschlagen, und ich weiß nicht, warum. Prüfen Sie die Konsole und melden Sie dies als Fehler.",
			"in-use": "Bereits in Verwendung.",
		},
		"change-password": {
			title: "Passwort ändern",
			success: "Passwort erfolgreich geändert.",
			forgot: "Passwort vergessen?",
			prompt: "Geben Sie die E-Mail-Adresse oder den Nutzernamen Ihres Kontos ein.",
			reset: "Zurücksetzen",
			sent: "Passwort-Reset-E-Mail gesendet.",
			failed: "Passwort konnte nicht zurückgesetzt werden.",
		},
	},
	"permissions-editor": {
		title: "Berechtigungs-Editor",
		text1: "Alle Berechtigungen, die weniger privilegierten Benutzern gewährt werden, werden automatisch auch den höher privilegierten Benutzern gewährt.",
		text2: "Administratoren haben alle Rechte. Der Raumbesitzer ist automatisch Administrator und kann nicht degradiert werden.",
		"viewing-as": "Ansicht als",
		permission: "Berechtigung",
	},
	"client-settings": {
		title: "Anpassen",
		description:
			"Diese Einstellungen werden in Ihrem Browser gespeichert und betreffen nur Sie.",
		activator: "@:client-settings.title",
		"room-layout": "Raum-Layout",
		theme: "Theme",
		"sfx-enable": "Soundeffekte aktivieren",
		"sfx-volume": "Soundeffekt-Lautstärke",
		"room-settings": "Standardraumeinstellungen",
	},
	"connect-overlay": {
		title: "Verbindung getrennt",
		"find-another": "Einen anderen Raum finden",
		"dc-reasons": {
			[OttWebsocketError.UNKNOWN]: "@:connect-overlay.dc-reasons.unknown",
			[OttWebsocketError.ROOM_NOT_FOUND]: "Raum nicht gefunden.",
			[OttWebsocketError.ROOM_UNLOADED]: "Raum wurde entladen.",
			[OttWebsocketError.MISSING_TOKEN]:
				"Es wurde kein Token bereitgestellt. Aktualisieren Sie die Seite und versuchen Sie es erneut. Andernfalls öffnen Sie bitte ein Issue auf GitHub.",
			[OttWebsocketError.KICKED]: "Sie wurden von einem Benutzer aus dem Raum geworfen.",
			unknown:
				"Etwas ist passiert, aber wir wissen nicht was. Bitte melden Sie dies als Bug.",
		},
	},
	"vote-skip": {
		remaining: "{count} weitere Stimmen zum Überspringen",
	},
	roles: {
		[Role.Administrator]: "Administrator",
		[Role.Moderator]: "Moderator",
		[Role.TrustedUser]: "Vertrauensvoller Nutzer",
		[Role.RegisteredUser]: "Registrierter Nutzer",
		[Role.UnregisteredUser]: "Nicht registrierter Nutzer",
		[Role.Owner]: "Besitzer",
	},
	errors: {
		BadPasswordError:
			"Passwort erfüllt nicht die Mindestanforderungen. Muss mindestens 8 Zeichen lang sein und 2 der folgenden Kategorien enthalten: Kleinbuchstaben, Großbuchstaben, Zahlen, Sonderzeichen.",
		BadApiArgumentException:
			"Schlechtes API-Argument. Dies ist wahrscheinlich ein Bug, bitte melden Sie es.",
	},
	player: {
		"buffer-warn": {
			spans: "Sie haben noch nicht genug von dem Video gepuffert. Aktuelle Zeit-Bereiche gepuffert: {ranges}",
		},
	},
};
