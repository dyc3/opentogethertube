import { OttWebsocketError, BehaviorOption, Role } from "ott-common/models/types";

export default {
    "common": {
        "yes": "Si",
        "no": "No",
        "ok": "OK",
        "cancel": "Cancelar",
        "close": "Cerrar",
        "close-all": "Cerrar Todos",
        "add": "Agregar",
        "remove": "Eliminar",
        "delete": "Borrar",
        "play": "Jugar",
        "pause": "Pausar",
        "save": "Guardar",
        "search": "Buscar",
        "undo": "Deshacer",
        "copy": "Copiar",
        "show": "Mostrar",
        "hide": "Esconder",
        "discard": "Desechar",
        "loading": "Cargando...",
        "view": "Mirar",
        "restore": "Restaurar",
        "success": "Éxito",
    },
    "landing": {
        hero: {
            title: "Disfrutar juntos.",
            description:
                "Reproducción sincronizada en tiempo real. Sistema de votación opcional.\nModo oscuro. No es necesario registrarse. Código fuente abierto.\nNunca ha sido tan fácil ver vídeos juntos.",
            btns: {
                create: "@:nav.create.title",
                browse: "Navegar salas",
                source: "Ver el código original",
            },
        },
        intro: {
            title: "Las fiestas de visualización remota ahora son mucho más fáciles",
            name: "OpenTogetherTube",
            text1: "Es una plataforma de sincronizacion de videos en tiempo real.\nEs fácil para usar y no tienes que inscribirte. Simplemente crea un sala, agrega videos y\ninvita a tus amigos. BOOM! Estás listo para disfrutar de videos con tus amigos hasta las 3 de la mañana",
            text2: "El TogetherTube original fue amado por su interfaz simple,\ny lo fácil que fue empezar a ver vídeos de inmediato.\nOpenTogetherTube pretende ser igual de fácil de usar y luego mejoralo\npara hacerlo aún mejor.",
            text3: "Actualmente, puedes ver videos en línea con tus amigos de Youtube, Vimeo, Dailymotion, enlaces directos a videos .mp4 y",
            link: "hay más en camino",
        },
        features: {
            "title": "Características Principales",
            "syncronized-playback": {
                title: "Reproducción sincronizada",
                text: "Golpea play, y el video se reproduce para todos\nen la sala. Asi de simple",
            },
            "permanent-rooms": {
                title: "Salas Permanentes",
                text: "You and the squad come here often? Avoid the hastle\nof sending out a new link every time. Permanent\nrooms get a custom url that doesn't change.",
            },
            "dark-theme": {
                title: "Modo Oscuro",
                text: "¿Estás viendo recopilaciones de Vine a altas horas de la noche?\nOpenTogetherTube tiene un modo oscuro automáticamente\npara que tus ojos no sufran.",
            },
            "room-permissions": {
                title: "Permisos de sala",
                text: "¿Cansado de desconocidos que se unen a tu sala y\ny agregando videos ruidosos a tu sesión relaja de hip-hop lofi?\nSimplemente bloquéelos para que no agreguen videos.",
            },
            "voting-system": {
                title: "Sistema de votación",
                text: "¿No puedes decidir qué ver a continuación? Cambie la cola\nal sistema de votación y deje que la democracia haga\nlo que mejor sabe hacer.",
            },
            "playlist-copying": {
                title: "Copia de lista de reproducción",
                text: "Agregue listas de reproducción o canales completos a la cola de videos\nde una vez para no tener que quedarse sentado agregando\ncada video a la cola uno por uno. Es la mejor manera\nde ver ese nuevo canal con tus amigos.",
            },
        },
        support: {
            title: "Apoyar el Desarrollo",
            description1:
                "OpenTogetherTube no sería posible sin la ayuda de contribuyentes y seguidores como usted.",
            description2:
                "Participe en el desarrollo contribuyendo con sus ideas o código, o muestre su apoyo convirtiéndose en patrocinador. Todas las donaciones se utilizan para pagar los costos de alojamiento, para el desarrollo de OpenTogetherTube y para mantener OpenTogetherTube libre de publicidad.",
            how: "¿Cómo puedo ayudar?",
            sponsor: "Conviértete en patrocinador",
            contribute: "Contribuir",
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
