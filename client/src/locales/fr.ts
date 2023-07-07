import { OttWebsocketError } from "ott-common/models/types";

export default {
	"common": {
		"yes": "Oui",
		"no": "Non",
		"cancel": "Annuler",
		"close": "Fermer",
		"close-all": "Tout Fermer",
		"add": "Ajouter",
		"remove": "Retirer",
		"delete": "Supprimer",
		"save": "Enregistrer",
		"search": "Rechercher",
		"undo": "Retour",
	},
	"landing": {
		hero: {
			title: "S'amuser ensemble !",
			description:
				"Vidéo synchronisée en temps réel. Système de vote optionnel.Thème Sombre. Pas de connexion requise. Tout est OpenSource. Il n'as jamais été aussi simple de regarder des vidéos ensemble!",
			btns: {
				create: "@:nav.create.title",
				browse: "Parcourir les salles",
				source: "Voir les sources",
			},
		},
		intro: {
			title: "Regarder des vidéos ensemble à distance est devenue beaucoup plus facile.",
			name: "OpenTogetherTube",
			text1: "Plateforme de synchronisation de vidéo en temps réel. Facile d'utilisation et sans connexion. Créer simplement une salle, ajoute une vidéo et invite t'es amis. BOOM! Tu es prêt pour regarder des vidéos avec t'es potes jusqu'à 3h du mat.",
			text2: "Le TogetherTube original est aimé pour son interface très simpliste, et sa rapidité pour lancer des vidéos. OpenTogetherTube vise à être tout aussi simple et à s'améliorer pour qu'il devienne encore meilleur au fil du temps.",
			text3: "Actuellement, vous pouvez regarder des vidéos depuis : Youtube, Vimeo, Dailymotion, liens directs vers des vidéos .mp4, ...",
			link: "d'autres sources arrivent bientôt",
		},
		features: {
			"title": "Fonctionnalités Principales",
			"syncronized-playback": {
				title: "Vidéo synchronisée",
				text: "Appuies sur le bouton play et la vidéo se lance pour tout le monde dans la salle. Aussi simple que ça.",
			},
			"permanent-rooms": {
				title: "Salles Permanentes",
				text: "Toi et t'es amis êtes des utilisateurs réguliers ? Tu peux créer une salle permanente qui te permettra de conserver la même URL pour ta salle",
			},
			"dark-theme": {
				title: "Theme Sombre",
				text: "Tu regardes des vidéos tard le soir avec t'es copains ? Evitez de vous abimer les yeux avec le Theme Sombre",
			},
			"room-permissions": {
				title: "Permissions de salle",
				text: "Fini les trolls ou tout autre problème dû à des gens mal intentionnés. Gère toutes les permissions de ta salle pour qu'ils ne puissent plus vous embêter.",
			},
			"voting-system": {
				title: "Système de vote",
				text: "Vous avez du mal à choisir quelle sera la prochaine vidéo à être regardée ? Passe du mode liste de lecture au système de vote pour que la vidéo la plus votée soit visionnée avant les autres.",
			},
			"playlist-copying": {
				title: "Ajoute des Playlist",
				text: "Ajoute une playlist ou carrément une chaîne entière dans la liste de lecture afin que tu ne sois pas obligé d'ajouter une par une les vidéos, c'est le meilleur moyen de découvrir une chaîne avec t'es amis.",
			},
		},
		support: {
			title: "Soutenir le développement",
			description1:
				"OpenTogetherTube n'existerait pas sans l'aide et les contributions des utilisateurs comme toi.",
			description2:
				"Vous pouvez nous aider en nous partageant vos idées ou même votre codage, vous pouvez montrer votre soutient en devenant un sponsor. Tous les dons sont utilisés pour payer les frais d'hebergement, pour le développement d'OpenTogetherTube et pour garder OpenTogetherTube sans publicité",
			how: "Comment puis-je aider ?",
			sponsor: "Devenir un sponsor",
			contribute: "Contribuer",
		},
	},
	"footer": {
		"disclaimer":
			"Information importante: OpenTogetherTube n'est pas associé à TogetherTube ou Watch2Gether.",
		"made-in": "Made in America",
		"thanks-to": "Remerciments spécial à",
		"privacy-policy": "Politique de Confidentialité",
		"attribution": "Attribution",
	},
	"not-found": {
		title: "Page non trouvée",
		home: "@:nav.home",
		browse: "@:landing.hero.btns.browse",
	},
	"quick-room": {
		text: "Création d'une salle temporaire pour vous...",
	},
	"attribution": {
		"sponsorblock-text": "Utilise les données SponsorBlock de",
	},
	"nav": {
		"home": "Accueil",
		"browse": "Parcourir",
		"faq": "FAQ",
		"bug": "Rapporter un bug",
		"support": "Me Soutenir!",
		"login": "Se connecter",
		"link-discord": "Lien Discord",
		"logout": "Se déconnecter",
		"create": {
			"title": "Créer une salle",
			"temp": "Créer une salle temporaire",
			"temp-desc": "Pour regarder des vidéos avec t'es amis rapidement.",
			"perm": "Créer une salle permanente",
			"perm-desc": "Parfait pour les utilisateurs réguliers.",
		},
	},
	"room-list": {
		"no-rooms": "Pas de salle pour le moment...",
		"create": "@:nav.create.title",
		"no-description": "Pas de description.",
		"nothing-playing": "Aucune lecture en cours.",
	},
	"room": {
		"title-temp": "Salle Temporaire",
		"kick-me": "Kick moi",
		"rewind": "Reculer de 10s",
		"skip": "Avancer de 10s",
		"play-pause": "Play/Pause",
		"next-video": "Vidéo suivante",
		"toggle-fullscreen": "Mettre en plein-ecran",
		"con-status": {
			connecting: "Connection...",
			connected: "Connecté",
		},
		"tabs": {
			queue: "Liste de lecture",
			settings: "Paramètres",
		},
		"users": {
			title: "Utilisateurs",
			set: "Change ton nom d'utilisateur",
			empty: "Il semble qu'il n'y ait personne d'autre ici. Inviter des amis !",
			you: "Vous",
			demote: "Rétrograder",
			promote: "Promouvoir",
		},
	},
	"privacy": {
		title: "@:footer.privacy-policy",
	},
	"chat": {
		"title": "Chat",
		"type-here": "Écris ton message ici...",
	},
	"share-invite": {
		title: "Partager l'invitation",
		text: "Copie ce lien et partage le à t'es amis!",
		copied: "Copié!",
	},
	"video": {
		"add-explanation": "Ajouter à la liste de lecture.",
		"playnow": "Lancer maintenant",
		"playnow-explanation":
			"Lire cette vidéo maintenant, en déplaçant la vidéo actuelle en haut de la file d'attente.",
		"no-video": "Aucune vidéo n'est en cours de lecture.",
		"no-video-text": 'Cliques sur "Ajouter" ci-dessous pour ajouter une vidéo.',
	},
	"add-preview": {
		"add-all": "Ajouter tout",
		"placeholder":
			"Tapes pour faire une recherche Youtube ou entre une URL de vidéo pour l'ajouter à la liste de lecture",
		"title": "Que puis-je ajouter ?",
		"single-videos": "Vidéos uniques",
		"playlists": "Playlists",
		"playlist": "Playlist",
		"text": "Ou tapes juste du texte pour faire une recherche Youtube.",
		"search-for":
			'Recherche Youtube pour "{search}" en appuyant sur entrée, ou en cliquant sur le bouton recherche.',
		"platforms": {
			"youtube-videos": "Des vidéos Youtube: {url}",
			"vimeo-videos": "Des vidéos Vimeo: {url}",
			"dailymotion-videos": "Des vidéos Dailymotion: {url}",
			"any-mp4-videos": "Toutes les vidéos .mp4 publiques: {url}",
			"youtube-playlists": "Les playlists Youtube: {url}",
			"youtube-channels": "Les chaînes Youtube: {url}",
			"subreddits": "Subreddits: {url}",
		},
		"messages": {
			"unknown-status": "Statut inconnu, impossible de donner un aperçu pour : {status}.",
			"unknown-error":
				"Une erreur inconnue s'est produite lors de l'obtention de l'aperçu. Réessayez plus tard.",
			"failed-to-get-add-preview":
				"Échec de l'obtention de l'aperçu. Il s'agit probablement d'un bug, consultez la console pour plus de détails.",
			"failed-to-all-videos": "Échec de toutes les vidéos: {message}",
		},
	},
	"processed-text": {
		"link-hint": "Cliques pour copier le lien dans l'onglet d'ajout.",
	},
	"video-queue": {
		"no-videos": "Il n'y a pas de vidéos dans la liste de lecture.",
		"add-video": "Ajouter une vidéo",
	},
	"video-queue-item": {
		"experimental":
			"Support expérimental pour ce service ! Attendez-vous à ce qu'il y est beaucoup de bug.",
		"play-next": "Vidéo suivante",
		"play-last": "Vidéo précédente",
		"messages": {
			"video-added": "Vidéo ajoutée",
			"video-removed": "Vidéo supprimée",
		},
		"start-at": "Démarre à {timestamp}",
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
			"Comportement normal. Vous pouvez réorganiser manuellement les éléments de la liste de lecture.",
		"vote": "@:create-room-form.vote",
		"vote-hint": "La vidéo la plus votée est lue ensuite.",
		"loop": "Lire en boucle",
		"loop-hint": "Lorsque la vidéo se termine, elle se remet à la fin de la liste de lecture.",
		"dj": "DJ",
		"dj-hint":
			"Lorsque la vidéo se termine elle recommence depuis le début. Bien pour la musique de fond en boucle.",
		"auto-skip-text":
			"Ignorer automatiquement les segments sponsorisés, les intros, les auto-promos, etc. en utilisant les données SponsorBlock.",
		"permissions-not-available":
			"Les autorisations ne sont pas disponibles dans les salles temporaires.",
		"room-needs-owner":
			"Cette salle a besoin d'un propriétaire avant que les autorisations puissent être modifiées.",
		"login-to-claim": "Connectez-vous pour réclamer cette salle.",
		"arent-able-to-modify-permissions":
			"Vous ne pouvez pas modifier les autorisations dans ce salon.",
		"settings-applied": "Paramètres appliqués",
		"now-own-the-room": "Vous êtes maintenant propriétaire de la chambre {room}.",
		"load-failed": "Échec du chargement des paramètres de la salle.",
	},
	"create-room-form": {
		"card-title": "Créer une salle permanente",
		"create-room": "Crée une salle",
		"name": "Nom",
		"name-hint": "Utilisé dans l'URL de la salle. Ne peut pas être modifié ultérieurement.",
		"title": "Titre",
		"title-hint": "Optionel",
		"description": "Description",
		"description-hint": "@:create-room-form.title-hint",
		"visibility": "Visibilité",
		"visibility-hint": "Contrôle si la salle s'affiche ou non dans la liste des salles.",
		"queue-mode": "Mode Liste de lecture",
		"manual": "Manuel",
		"vote": "Vote",
		"public": "Publique",
		"unlisted": "Non listée",
		"rules": {
			"name": {
				"name-required": "Le nom est requis",
				"no-spaces": "Le nom ne doit pas contenir d'espaces.",
				"length": "Le nom doit comporter entre 3 et 32 caractères",
				"alphanumeric":
					"Le nom ne doit contenir que des caractères alphanumériques, des tirets et des traits de soulignement",
				"taken": "Le nom est déjà pris",
			},
			"invalid-visibility": "Visibilité invalide",
			"invalid-queue": "Mode liste de lecture invalide",
		},
		"unknown-error": "Une erreur inconnue est survenue. Réessayez plus tard.",
	},
	"login-form": {
		"login": "@:nav.login",
		"register": "S'enregistrer",
		"login-discord": "Se connecter via Discord",
		"email": "Email",
		"username": "Nom d'utilisateur",
		"password": "Mot de passe",
		"retype-password": "Retaper le mot de passe",
		"rules": {
			"email-required": "Email requis",
			"valid-email": "L'email doit être valide",
			"username-required": "Nom d'utilisateur requis",
			"username-length":
				"Le nom d'utilisateur doit être compris entre 1 et {length} caractères",
			"password-required": "Mot de passe requis",
			"password-length": "Le mot de passe doit comporter au moins 10 caractères",
			"retype-password": "Veuillez retaper votre mot de passe",
			"passwords-match": "Les mots de passe doivent correspondre",
		},
		"errors": {
			"something-weird-happened":
				"Quelque chose de bizarre s'est produit, mais vous êtes peut-être connecté ? Actualisez la page.",
			"login-failed-noserver":
				"Échec de la connexion, mais le serveur n'a pas dit pourquoi. Signalez ceci comme un bug.",
			"login-failed":
				"Échec de la connexion, et nous ne savons pas pourquoi. Signalez ceci comme un bug.",
			"register-failed-noserver":
				"Échec de l'inscription, mais le serveur n'a pas dit pourquoi. Signalez ceci comme un bug.",
			"register-failed":
				"Échec de l'inscription, et nous ne savons pas pourquoi. Vérifiez la console et signalez-le comme un bug.",
			"in-use": "Déjà utilisé.",
		},
	},
	"permissions-editor": {
		"title": "Editeurs des permissions",
		"text1":
			"Toutes les autorisations accordées aux utilisateurs moins privilégiés sont automatiquement accordées aux utilisateurs plus privilégiés.",
		"text2":
			"Les administrateurs ont tous les droits. Le propriétaire de la salle est automatiquement administrateur et ne peut pas être rétrogradé.",
		"viewing-as": "Affichage en tant que",
		"permission": "Permission",
		"roles": {
			"administrator": "Administrator",
			"moderator": "Moderator",
			"trustedUser": "Trusted User",
			"registeredUser": "Registered User",
			"unregisteredUser": "Unregistered User",
			"owner": "Owner",
		},
	},
	"client-settings": {
		title: "Préférences",
		description:
			"Ces paramètres sont enregistrés dans votre navigateur et n'affectent que vous.",
		activator: "@:client-settings.title",
	},
	"connect-overlay": {
		"title": "Déconnecté",
		"find-another": "Trouver une autre salle",
		"dc-reasons": {
			[OttWebsocketError.UNKNOWN]: "@:connect-overlay.dc-reasons.unknown",
			[OttWebsocketError.ROOM_NOT_FOUND]: "Salle non trouvée.",
			[OttWebsocketError.ROOM_UNLOADED]: "La salle a été supprimée.",
			[OttWebsocketError.MISSING_TOKEN]:
				"Un jeton n'a pas été fourni. Actualisez la page et réessayez. Sinon, veuillez ouvrir un ticket sur GitHub.",
			unknown:
				"Il s'est passé quelque chose, mais nous ne savons pas quoi. Veuillez signaler ceci comme un bug.",
		},
	},
};
