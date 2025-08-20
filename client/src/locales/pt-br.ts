import { BehaviorOption, OttWebsocketError, Role } from "ott-common/models/types";

export default {
	common: {
		yes: "Sim",
		no: "Não",
		ok: "OK",
		cancel: "Cancelar",
		close: "Fechar",
		"close-all": "Fechar Tudo",
		add: "Adicionar",
		remove: "Remover",
		delete: "Excluir",
		play: "Play",
		pause: "Pausar",
		save: "Salvar",
		search: "Pesquisar",
		undo: "Desfazer",
		copy: "Copiar",
		show: "Mostrar",
		hide: "Esconder",
		discard: "Descartar",
		loading: "Carregando...",
		view: "Visualizar",
		restore: "Restaurar",
		success: "Sucesso",
		vote: "Votar",
		unvote: "Desvotar",
		on: "Ligado",
		off: "Desligado",
		dismiss: "Dispensar",
		errors: {
			"rate-limit":
				"Taxa limite de requisições excedida. Por favor, tente novamente em {duration} segundos.",
		},
	},
	behavior: {
		[BehaviorOption.Always]: "Sempre",
		[BehaviorOption.Prompt]: "Pergunte-me",
		[BehaviorOption.Never]: "Nunca",
	},
	landing: {
		hero: {
			title: "Cola Junto!",
			description:
				"Reprodução sincronizada em tempo real. Sistema de votação opcional.\nTema escuro. Sem necessidade de cadastro. Totalmente Open Source.\nNunca foi tão fácil assistir vídeos com a galera.",
			btns: {
				create: "@:nav.create.title",
				browse: "Achar Salas",
				source: "Código Fonte",
			},
		},
		intro: {
			title: "Ficou muito mais fácil criar sessões remotas de vídeos.",
			name: "OpenTogetherTube",
			text1: "É uma plataforma de reprodução sincronizada em tempo real.\nÉ fácil de usar e não precisa de login ou cadastro. Apenas crie uma sala, coloque vídeos e\nchame seus amigos. TOMA! Você já pode degustar seus vídeos com seus amigos até 3 horas da matina.",
			text2: "O TogetherTube original era amado por sua interface simples de usar,\ne o quão fácil era começar assistir vídeos sem complicações.\nOpenTogetherTube almeja ser tão fácil quanto, e melhorar a sua experiência \nainda mais, deixando-o ainda melhor.",
			text3: "Atualmente você pode assistir vídeos online com seus amigos pelo Youtube, Vimeo, links diretos de arquivos .mp4, e",
			link: "mais integrações a caminho",
		},
		features: {
			title: "Principais funcionalidades",
			"synchronized-playback": {
				title: "Reprodução sincronizada",
				text: "Aperte play, e o vídeo reproduz para todos\nque estão na sala. Simples, rápido e prático.",
			},
			"permanent-rooms": {
				title: "Salas permanentes",
				text: "Você e sua tropa vem sempre aqui? Evite a inconveniência\nde mandar um link novo toda vez. Salas\npermanentes possuem um url personalizado que não muda.",
			},
			"dark-theme": {
				title: "Tema escuro",
				text: "Assistir compilados de Vine altas horas da noite?\nOpenTogetherTube tem um modo escuro como padrão, então\nseus olhos não vão sofrer.",
			},
			"room-permissions": {
				title: "Permissões de sala",
				text: "Cansado de um randola qualquer entrar na sala e adicionar\numa tonelada de videos barulhentos na sua sessão calma de lofi?\nÉ só bloquear ele de adicionar vídeos.",
			},
			"voting-system": {
				title: "Sistema de votação",
				text: "Não consegue decidir o que vai assistir depois? Mude a fila\npara sala com sistema de votação e deixa a democracia fazer o que\nela faz de melhor.",
			},
			"playlist-copying": {
				title: "Cópia de playlists",
				text: "Adicione uma playlist inteira ou canais na fila de vídeos\ntudo de uma única vez, assim você não precisa parar tudo para adicionar\ncada vídeo à fila um por um. É a melhor\nforma de curtir os vídeos daquele novo canal com seus amigos.",
			},
		},
		support: {
			title: "Apoie o desenvolvimento",
			description1:
				"OpenTogetherTube não seria possível sem a ajuda de contribuidores e apoiadores como você.",
			description2:
				"Contribua com o desenvolvimento com suas ideias ou código, ou mostre seu apoio tornando-se um apoiador. Todas as doações são usadas para pagar custos de hospedagem, desenvolvimento do OpenTogetherTube, e manter o OpenTogetherTube livre de anúncios.",
			how: "Como posso ajudar?",
			sponsor: "Tornar-me um Apoiador",
			contribute: "Contribuir",
		},
	},
	footer: {
		disclaimer:
			"Disclaimer: O projeto OpenTogetherTube não é associado ao TogetherTube, nem ao Watch2Gether.",
		"made-in": "Made in America",
		"thanks-to": "Agradecimento especial para",
		"privacy-policy": "Política de privacidade",
		attribution: "Atribuição",
	},
	"not-found": {
		title: "Página não encontrada",
		home: "@:nav.home",
		browse: "@:landing.hero.btns.browse",
	},
	"quick-room": {
		text: "Criando uma sala temporária para você...",
	},
	attribution: {
		"sponsorblock-text": "Usa dados de bloqueador de anúncios de",
	},
	nav: {
		home: "Início",
		browse: "Descobrir",
		faq: "FAQ",
		bug: "Reportar um bug",
		support: "Apoie-me!",
		login: "Log In",
		"link-discord": "Link discord",
		logout: "Sair",
		create: {
			title: "Criar sala",
			temp: "Criar sala temporária",
			"temp-desc": "Começar a assistir vídeos com os seus amigos imediatamente.",
			perm: "Criar sala permanente",
			"perm-desc": "Perfeito para visitantes recorrentes.",
		},
	},
	"room-list": {
		"no-rooms": "Sem salas disponíveis no momento...",
		create: "@:nav.create.title",
		"no-description": "Sem descrição.",
		"nothing-playing": "Nada sendo reproduzido.",
	},
	room: {
		"title-temp": "Sala temporária",
		"kick-me": "Expluse-me",
		rewind: "Voltar 10s",
		skip: "Pular 10s",
		"play-pause": "Play/Pausar",
		"next-video": "Próximo Vídeo",
		"next-video-vote": "Votar para pular vídeo",
		"toggle-fullscreen": "Tela cheia",
		"con-status": {
			connecting: "Conectando...",
			connected: "Conectado",
		},
		tabs: {
			queue: "Fila",
			settings: "Configurações",
		},
		users: {
			title: "Usuários",
			set: "Defina seu nome/apelido",
			empty: "Parece não ter mais ninguém aqui. Convide seus amigos!",
			you: "Você",
			demote: "Rebaixar",
			promote: "Promover",
			kick: "Expulsar",
		},
	},
	privacy: {
		title: "@:footer.privacy-policy",
	},
	chat: {
		title: "Chat",
		"type-here": "Digite sua mensagem aqui...",
	},
	"share-invite": {
		title: "Compartilhar convite",
		text: "Copie esse link e compartilhe com seus amigos!",
		copied: "Copiado!",
	},
	video: {
		"add-explanation": "Adicionar à fila.",
		playnow: "Reproduzir agora",
		"playnow-explanation":
			"Reproduza esse vídeo imediatamente, colocando o vídeo atual no topo da fila.",
		"no-video": "Nenhum vídeo está sendo reproduzido.",
		"no-video-text": 'Clique em "Adicionar" abaixo para adicionar um vídeo.',
	},
	"add-preview": {
		label: "Link ou pesquisa",
		"add-all": "Adicionar tudo",
		placeholder:
			"Digite para pesquisar no YouTube ou adicione uma URL de vídeo para adicionar à fila",
		title: "O que eu posso adicionar?",
		"single-videos": "Vídeos Avulsos",
		playlists: "Playlists",
		playlist: "Playlist",
		text: "Ou apenas digite um texto para pesquisar no YouTube.",
		"search-for": 'Pesquise "{search}" no YouTube apertando enter, ou clicando em "Pesquisar".',
		platforms: {
			"youtube-videos": "Vídeos do YouTube: {url}",
			"vimeo-videos": "Vídeos do Vimeo: {url}",
			"any-mp4-videos": "Qualquer vídeo .mp4 público: {url}",
			"youtube-playlists": "Playlists do YouTube: {url}",
			"youtube-channels": "Canais do YouTube: {url}",
		},
		messages: {
			"unknown-status": "Status de resposta inesperada ao carregar o player: {status}.",
			"unknown-error":
				"Ocorreu um erro desconhecido enquanto adicionava o player. Tente novamente mais tarde.",
			"failed-to-get-add-preview":
				"Falha ao adicionar o player. Isso é um bug provavelmente, olhe o console para mais detalhes.",
			"failed-to-all-videos": "Falha de todos os vídeos: {message}",
		},
	},
	"processed-text": {
		"link-hint": 'Clique para copiar esse link para a aba "Adicionar".',
	},
	"video-queue": {
		"no-videos": "Não há videos na fila.",
		"add-video": "Adicionar vídeo",
		export: "Exportar",
		"export-diag-title": "Exportar fila",
		"export-hint": 'Copie e cole esse texto na aba "Adicionar" para restaurar essa fila.',
		restore: "Gostaria de restaurar os vídeos da fila anterior?",
		"restore-queue": "Restaurar fila?",
		"restore-queue-hint":
			"A fila estava assim da última vez que a sala esteve ativa. Gostaria de restaurar a sessão?",
	},
	"video-queue-item": {
		experimental:
			"O suporte para esse serviço é experimental! É bem provável que sua experiência seja instável.",
		"play-next": "Próximo",
		"play-last": "Voltar",
		messages: {
			"video-added": "Vídeo adicionado",
			"video-removed": "Vídeo removido",
		},
		"start-at": "Iniciar aos {timestamp}",
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
			"Comportamento padrão, funciona exatamente como você espera que funcione. Você pode reorganizar os itens da fila manualmente.",
		vote: "@:common.vote",
		"vote-hint": "O vídeo mais votado é reproduzido em seguida.",
		loop: "Loop",
		"loop-hint": "Quando o vídeo atual acaba é colocado no final da fila.",
		dj: "DJ",
		"dj-hint":
			"Quando o vídeo atual acaba é reiniciado do começo. Bom para músicas de fundo tocando em loop.",
		"auto-skip-text":
			"Pula automaticamente segmentos não desejados do vídeo utilizando dados de bloqueadores de anúncios.",
		"auto-skip-text-sponsor": "patrocinador",
		"auto-skip-text-intro": "intro",
		"auto-skip-text-outro": "outro",
		"auto-skip-text-interaction": "interação",
		"auto-skip-text-selfpromo": "auto-promo",
		"auto-skip-text-music_offtopic": "interlúdio (offtopic)",
		"auto-skip-text-preview": "prévia",
		"permissions-not-available":
			"Configurações de permissões não estão disponíveis em salas temporárias.",
		"room-needs-owner":
			"Essa sala precisa de um dono para que as permissões possam ser alteradas.",
		"login-to-claim": "Faça login para reivindicar essa sala.",
		"arent-able-to-modify-permissions":
			"Você não está autorizado a modificar as permissões dessa sala.",
		"settings-applied": "Configurações aplicadas",
		"now-own-the-room": "Agora você é dono da sala {room}.",
		"load-failed": "Falha ao carregar configurações da sala.",
		"restore-queue": "Restaurar a fila quando a sala for carregada",
		"enable-vote-skip": "Ativar votação para pular vídeo",
	},
	"create-room-form": {
		"card-title": "Criar sala permanente",
		"create-room": "Criar sala",
		name: "Nome",
		"name-hint": "Usado no URL da sala. Não pode ser alterado.",
		title: "Título",
		"title-hint": "Opcional",
		description: "Descrição",
		"description-hint": "@:create-room-form.title-hint",
		visibility: "Visibilidade",
		"visibility-hint": "Controla quando a sala deve ou não ser listada na lista de salas.",
		"queue-mode": "Modo de Fila",
		manual: "Manual",
		vote: "@:common.vote",
		loop: "@:room-settings.loop",
		dj: "@:room-settings.dj",
		public: "Publica",
		unlisted: "Não listada",
		rules: {
			name: {
				"name-required": "Nome é um campo obrigatório",
				"no-spaces": "O nome não deve conter espaços",
				length: "O nome deve ter entre 3 e 32 caracteres",
				alphanumeric:
					"O nome deve conter apenas caracteres alfa-numéricos, traços e underscores",
				taken: "Esse nome já está sendo usado",
			},
			"invalid-visibility": "Visibilidade inválida",
			"invalid-queue": "Modo de fila inválido",
		},
		"unknown-error": "Ocorreu um erro não identificado. Tente novamente mais tarde.",
	},
	"login-form": {
		login: "@:nav.login",
		register: "Register",
		"login-discord": "Fazer login com Discord",
		email: "E-mail",
		"email-or-username": "E-mail ou usuário",
		username: "Usuário",
		password: "Senha",
		"retype-password": "Digite a senha novamente",
		"email-optional":
			"Opcional. Com um e-mail associado ao login é possível recuperar a conta caso você esqueça a senha.",
		rules: {
			"email-required": "E-mail é um campo obrigatório",
			"valid-email": "Você deve fornecer um e-mail válido Must be a valid email",
			"username-required": "Usuário é um campo obrigatório",
			"username-length": "O usuário deve ter entre 1 e {length} caracteres",
			"password-required": "Senha é um campo obrigatório",
			"password-length": "A senha deve ter no mínimo 10 caracteres",
			"retype-password": "Por favor, escreva sua senha novamente",
			"passwords-match": "As senhas não coincidem",
		},
		errors: {
			"something-weird-happened":
				"Algo estranho aconteceu, mas você está conectado? Atualize a página.",
			"login-failed-noserver":
				"Falha ao fazer login, mas o servidor não reportou o motivo. Reporte esse erro como um bug.",
			"login-failed":
				"Falha ao fazer login, mas não sabemos o motivo. Reporte esse erro como um bug.",
			"register-failed-noserver":
				"Falha ao se cadastrar, mas o servidor não reportou o motivo. Reporte esse erro como um bug.",
			"register-failed":
				"Falha ao se cadastrar, e não sabemos o motivo. Verifique o console e reporte esse erro como um bug.",
			"in-use": "Já está sendo usado.",
		},
		"change-password": {
			title: "Mudar senha",
			success: "Senha alterada com sucesso.",
			forgot: "Esqueceu a senha?",
			prompt: "Insira o endereço de email ou o usuário associado à sua conta.",
			reset: "Recuperar",
			sent: "O e-mail para recuperação de acesso foi enviado.",
			failed: "Não foi possível recuperar seu acesso.",
		},
	},
	"permissions-editor": {
		title: "Editor de permissões",
		text1: "Todas as permissões concedidas aos usuários com menos privilégios são também concedidas aos usuários com mais privilégios.",
		text2: "Administradores possuem todos os privilégios. O dono da sala é automaticamente Administrador e não pode ser rebaixado.",
		"viewing-as": "Visualizando como",
		permission: "Permissão",
	},
	"client-settings": {
		title: "Preferências",
		description: "Essas configurações são salvas no seu navegador e afetam apenas você.",
		activator: "@:client-settings.title",
		"room-layout": "Layout da sala",
		theme: "Tema",
		"sfx-enable": "Ativar efeitos sonoros",
		"sfx-volume": "Volume dos efeitos sonoros",
	},
	"connect-overlay": {
		title: "Desconectado",
		"find-another": "Achar outra sala",
		"dc-reasons": {
			[OttWebsocketError.UNKNOWN]: "@:connect-overlay.dc-reasons.unknown",
			[OttWebsocketError.ROOM_NOT_FOUND]: "Sala não encontrada.",
			[OttWebsocketError.ROOM_UNLOADED]: "A sala foi desconectada.",
			[OttWebsocketError.MISSING_TOKEN]:
				"Um token não foi adicionado. Atualize a página e tente novamente. Caso estiver achando que isso é um erro, por favor, abra um 'issue' no GitHub.",
			[OttWebsocketError.KICKED]: "Você foi expulso da sala por um usuário.",
			unknown: "Algo estranho aconteceu. Por favor reporte isso como um bug.",
		},
	},
	"vote-skip": {
		remaining: "Mais {count} votos necessários para pular",
	},
	roles: {
		[Role.Administrator]: "Administrador",
		[Role.Moderator]: "Moderador",
		[Role.TrustedUser]: "Usuário confiável",
		[Role.RegisteredUser]: "Usuário cadastrado",
		[Role.UnregisteredUser]: "Usuário convidado",
		[Role.Owner]: "Dono",
	},
	errors: {
		BadPasswordError:
			"A senha não atende aos requisitos mínimos. Deve ter no mínimo 8 caracteres e conter no mínimo dois dos seguintes tipos de de caracteres: letras minúsculas, letras maiúsculas, números, caracteres especiais.",
		BadApiArgumentException: "Requisição inválida. Isso parece ser um bug, por favor, reporte.",
	},
	player: {
		"buffer-warn": {
			spans: "Você não carregou suficientemente do vídeo ainda. Carregando atualmente em intervalos de tempo de {ranges}",
		},
	},
};
