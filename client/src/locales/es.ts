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
				text: "¿Tú y el equipo vienen aquí bastante? Evite la molestia\nde enviar un enlace nuevo cada vez.  Las salas\npermanentes obtienen una URL personalizada que no cambia.",
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
			"Descargo de responsabilidad: El proyecto OpenTogetherTube no está asociado con TogetherTube ni con Watch2Gether.",
		"made-in": "Hecho en America",
		"thanks-to": "Agradecimientos especiales a",
		"privacy-policy": "Política de privacidad",
		"attribution": "Atribución",
	},
	"not-found": {
		title: "Página no encontrada",
		home: "@:nav.home",
		browse: "@:landing.hero.btns.browse",
	},
	"quick-room": {
		text: "Haciendo una sala temporaria para ti...",
	},
	"attribution": {
		"sponsorblock-text": "Utiliza SponsorBlock datos de",
	},
	"nav": {
		"home": "Página Principal",
		"browse": "Navegar",
		"faq": "FAQ",
		"bug": "Reportar un Error",
		"support": "Apoyarme!",
		"login": "Registrarse",
		"link-discord": "Conectar Discord",
		"logout": "Cerrar Sesión",
		"create": {
			"title": "Crear Sala",
			"temp": "Crear Sala Temporaria",
			"temp-desc": "Comienza a ver videos con tus amigos ahora",
			"perm": "Crear Sala Permanente",
			"perm-desc": "Perfecto para visitantes frecuentes.",
		},
	},
	"room-list": {
		"no-rooms": "No hay salas en este momento......",
		"create": "@:nav.create.title",
		"no-description": "Sin descripción.",
		"nothing-playing": "Nada Jugando.",
	},
	"room": {
		"title-temp": "Sala Temporario",
		"kick-me": "Sacame",
		"rewind": "Devolver 10s",
		"skip": "Adelantar 10s",
		"play-pause": "Reproducir/Pausar",
		"next-video": "Siguiente vídeo",
		"next-video-vote": "Vota para saltar el vídeo",
		"toggle-fullscreen": "Alternar pantalla completa",
		"con-status": {
			connecting: "Conectando...",
			connected: "Conectado",
		},
		"tabs": {
			queue: "Cola",
			settings: "Ajustes",
		},
		"users": {
			title: "Usuarios",
			set: "Establece tu nombre",
			empty: "Parece que no hay nadie más aquí. ¡Invita a algunos amigos!",
			you: "Tu",
			demote: "Degradar",
			promote: "Promover",
			kick: "Sacar",
		},
	},
	"privacy": {
		title: "@:footer.privacy-policy",
	},
	"chat": {
		"title": "Hablar",
		"type-here": "Escribe tu mensaje aquí...",
	},
	"share-invite": {
		title: "Compartir Invitacion",
		text: "Copia este enlace y compártelo con tus amigos!",
		copied: "Copiado!",
	},
	"video": {
		"add-explanation": "Agregar a la cola.",
		"playnow": "Reproducir ahora",
		"playnow-explanation":
			"Reproduce este video ahora, empujando el video actual al principio de la cola.",
		"no-video": "No se está reproduciendo ningún video.",
		"no-video-text": 'Haz clic en "Agregar" para añadir un video.',
	},
	"add-preview": {
		"add-all": "Agregar a la cola",
		"placeholder":
			"Escriba para buscar en YouTube o ingrese la URL de un video para agregarlo a la cola",
		"title": "Que puedo agregar??",
		"single-videos": "Vídeos Individuales",
		"playlists": "Listas de reproducción",
		"playlist": "Lista de reproducción",
		"text": "O simplemente escriba texto para buscar en Youtube.",
		"search-for": 'Busque "{search}" en YouTube presionando Intro o haciendo clic en Buscar.',
		"platforms": {
			"youtube-videos": "Vídeos de Youtube: {url}",
			"vimeo-videos": "Vídeos de Vimeo: {url}",
			"dailymotion-videos": "Vídeos de Dailymotion: {url}",
			"any-mp4-videos": "Cualquier video público .mp4: {url}",
			"youtube-playlists": "Listas de reproducción de youtube: {url}",
			"youtube-channels": "Canales de Youtube: {url}",
		},
		"messages": {
			"unknown-status":
				"Estado desconocido para agregar respuesta de vista previa: {status}.",
			"unknown-error":
				"Se produjo un error desconocido al obtener la vista previa de agregar. Vuelve a intentarlo más tarde.",
			"failed-to-get-add-preview":
				"No se pudo obtener la vista previa para agregar. Probablemente es un error; consulte la consola para obtener más detalles.",
			"failed-to-all-videos": "Error en todos los vídeos: {message}",
		},
	},
	"processed-text": {
		"link-hint": "Haga clic para copiar este enlace a la pestaña de agregar.",
	},
	"video-queue": {
		"no-videos": "No hay vídeos en la cola.",
		"add-video": "Agregar un vídeos",
		"export": "Exportar",
		"export-diag-title": "Exportar Cola",
		"export-hint": 'Copie y pegue este texto en la pestaña "Agregar" para restaurar esta cola.',
		"restore": "¿Quieres restaurar los vídeos de la cola anterior?",
		"restore-queue": "¿Restaurar Cola?",
		"restore-queue-hint":
			"Esto es lo que estaba en la cola la última vez que esta sala estuvo activa. ¿Quieres restaurarlo?",
	},
	"video-queue-item": {
		"experimental": "¡Soporte experimental para este servicio! Espere que se rompa mucho.",
		"play-next": "Reproducir Próximo",
		"play-last": "Reproducir Último",
		"messages": {
			"video-added": "Vídeo agregado",
			"video-removed": "Vídeos borrado",
		},
		"start-at": "Empieza en {timestamp}",
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
			"Comportamiento normal predeterminado, funciona como lo piensas. Puedes reordenar manualmente los elementos en la cola.",
		"vote": "@:create-room-form.vote",
		"vote-hint": "El vídeo más votado se reproduce a continuación.",
		"loop": "Loop",
		"loop-hint": "Cuando termine el video, colóquelo al final de la cola.",
		"dj": "DJ",
		"dj-hint":
			"Cuando termine el video, comience el mismo video desde el principio. Bueno para reproducir música de fondo.",
		"auto-skip-text":
			"Omitir automáticamente segmentos patrocinados, introducciones, autopromociones, etc. utilizando los datos de SponsorBlock.",
		"permissions-not-available": "Los permisos no están disponibles en salas temporarias",
		"room-needs-owner":
			"Esta sala necesita un propietario antes de poder modificar los permisos.",
		"login-to-claim": "Inicie sesión para reclamar esta sala.",
		"arent-able-to-modify-permissions": "No puedes modificar los permisos en esta sala.",
		"settings-applied": "Configuración aplicada",
		"now-own-the-room": "Ahora eres dueño de la sala {room}.",
		"load-failed": "No se pudo cargar la configuración de la sala.",
		"restore-queue": "Restaurar la cola cuando la sala esté cargada.",
		"enable-vote-skip": "Habilitar la omisión de votos",
	},
	"create-room-form": {
		"card-title": "Crear una Sala Permanente.",
		"create-room": "Crear Sala",
		"name": "Nombre",
		"name-hint": "Utilizado en la URL de la sala. No se puede cambiar más tarde.",
		"title": "Título",
		"title-hint": "Opcional",
		"description": "Descripción",
		"description-hint": "@:create-room-form.title-hint",
		"visibility": "Visibilidad",
		"visibility-hint": "Controla si la sala aparece o no en la lista de salas.",
		"queue-mode": "Modo de Cola",
		"manual": "Manual",
		"vote": "Votar",
		"public": "Público",
		"unlisted": "No incluido en listado",
		"rules": {
			"name": {
				"name-required": "Se requiere el nombre.",
				"no-spaces": "El nombre no debe contener espacios.",
				"length": "El nombre debe tener entre 3 y 32 caracteres.",
				"alphanumeric":
					"El nombre solo debe contener caracteres alfanuméricos, guiones y guiones bajos.",
				"taken": "Nombre ya esta en uso.",
			},
			"invalid-visibility": "Visibilidad no válida",
			"invalid-queue": "Modo de cola no válido",
		},
		"unknown-error": "Un error desconocido ocurrió. Vuelve a intentarlo más tarde.",
	},
	"login-form": {
		"login": "@:nav.login",
		"register": "Registrar",
		"login-discord": "Iniciar sesión con Discord.",
		"email": "Correo Electrónico",
		"email-or-username": "Correo Electrónico o Nombre de Usuario",
		"username": "Nombre de Usuario",
		"password": "Contraseña",
		"retype-password": "Vuelva a escribir la contraseña",
		"email-optional":
			"Dando un correo electrónico es opcional, pero hace imposible recuperar su cuenta si olvida su contraseña.",
		"rules": {
			"email-required": "Correo electronico es requerido",
			"valid-email": "Debe ser un correo electrónico válido",
			"username-required": "Se requiere nombre de usuario",
			"username-length": "El nombre de usuario debe tener entre 1 y {length} caracteres",
			"password-required": "Se requiere contraseña",
			"password-length": "La contraseña debe tener al menos 10 caracteres",
			"retype-password": "Por favor, escriba de nuevo su contraseña",
			"passwords-match": "Las contraseñas deben coincidir",
		},
		"errors": {
			"something-weird-happened":
				"Algo extraño sucedió, pero ¿es posible que hayas iniciado sesión? Recarga la página.",
			"login-failed-noserver":
				"No se pudo iniciar sesión, pero el servidor no dijo por qué. Reportar esto como un error.",
			"login-failed": "No pude iniciar sesión y no sé por qué. Reportar esto como un error.",
			"register-failed-noserver":
				"No se pudo registrar, pero el servidor no dijo por qué. Reportar esto como un error.",
			"register-failed":
				"No pude registrarme y no sé por qué. Verifique la consola y reportar esto como un error.",
			"in-use": "Ya en uso.",
		},
		"change-password": {
			title: "Cambiar la contraseña",
			success: "Cambio de contraseña exitoso.",
			forgot: "¿Olvidaste tu contraseña?",
			prompt: "Ingrese la dirección de correo electrónico o el nombre de usuario asociado con su cuenta.",
			reset: "Restablecer",
			sent: "Correo electrónico de restablecimiento de contraseña enviado.",
			failed: "No se puede restablecer la contraseña.",
		},
	},
	"permissions-editor": {
		"title": "Editor de permisos",
		"text1":
			"Todos los permisos concedidos a usuarios con menos privilegios se conceden automáticamente a usuarios con más privilegios.",
		"text2":
			"A los administradores se les concede todo. El propietario de la sala es automáticamente administrador y no puede ser degradado.",
		"viewing-as": "Viendo como",
		"permission": "Permisos",
	},
	"client-settings": {
		"title": "Preferencias",
		"description":
			"Estas configuraciones se guardan en su navegador y solo le afectan a usted.",
		"activator": "@:client-settings.title",
		"room-layout": "Diseño de la sala",
		"theme": "Modo",
		"sfx-enable": "Habilitar efectos de sonido",
		"sfx-volume": "Volumen del efecto de sonido",
	},
	"connect-overlay": {
		"title": "Desconectado",
		"find-another": "Encuentra otra sala",
		"dc-reasons": {
			[OttWebsocketError.UNKNOWN]: "@:connect-overlay.dc-reasons.unknown",
			[OttWebsocketError.ROOM_NOT_FOUND]: "Sala no encontrada.",
			[OttWebsocketError.ROOM_UNLOADED]: "La sala se ha cerrado.",
			[OttWebsocketError.MISSING_TOKEN]:
				"No se proporcionó ninguna token. Actualiza la página y vuelve a intentarlo. Si continúa, abra un problema en GitHub.",
			[OttWebsocketError.KICKED]: "Fuiste expulsado de la sala por un usuario.",
			unknown: "Algo pasó, pero no sabemos qué. Por favor, reporte esto como un error.",
		},
	},
	"vote-skip": {
		remaining: "{count} votos más para omitir",
	},
	"roles": {
		[Role.Administrator]: "Administrador",
		[Role.Moderator]: "Moderador",
		[Role.TrustedUser]: "Usuario Confiado",
		[Role.RegisteredUser]: "Usuario Registrado",
		[Role.UnregisteredUser]: "Usuario no Registrado",
		[Role.Owner]: "Dueño",
	},
	"errors": {
		BadPasswordError:
			"La contraseña no cumple con los requisitos mínimos. Debe tener al menos 8 caracteres y contener 2 de las siguientes categorías de caracteres: letras minúsculas, letras mayúsculas, números, caracteres especiales.",
		BadApiArgumentException: "Mal argumento de API. Probablemente es un error, Reportalo",
	},
	"player": {
		"buffer-warn": {
			spans: "Aún no has almacenado suficiente cantidad del vídeo. Intervalos de tiempo actuales almacenados en búfer: {range}",
		},
	},
};
