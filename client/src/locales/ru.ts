export default {
	"landing": {
		hero: {
			title: "Наслаждайтесь совместным просмотром.",
			description:
				"Синхронизированный просмотр в реальном времени. Опциональная система голосования.\nТёмная тема. Регистрация не требуется. Открытый исходный код.\nНикогда ещё не было так легко смотреть видео вместе.",
			btns: {
				create: "@:nav.create.title",
				browse: "Просмотр комнат",
				source: "Просмотр исходного кода",
			},
		},
		intro: {
			title: "Удалённый просмотр с друзьями теперь стал намного проще",
			name: "OpenTogetherTube",
			text1: " - платформа для синхронизированного просмотра видео в реальном времени.\nОна проста в использовании и не требует регистрации. Просто создайте комнату, добавьте видео и\nпригласите Ваших друзей. БУМ! Вы готовы смотреть видео со своими друзьями до 3 часов ночи.",
			text2: "Оригинальный TogetherTube был любим за его простой интерфейс,\nи за то, как легко было начать смотреть видео.\nOpenTogetherTube стремится быть таким же простым, продолжая совершенствоваться.",
			text3: "На данный момент Вы можете смотреть онлайн видео со своими друзьями с Youtube, Vimeo, Dailymotion, с прямых ссылок на видео в формате .mp4, и в ближайшее время их будет",
			link: "ещё больше.",
		},
		features: {
			"title": "Основные функции",
			"syncronized-playback": {
				title: "Синхронное воспроизведение",
				text: "Нажмите одну кнопку, и видео воспроизведётся для всех\nв комнате. Проще простого.",
			},
			"permanent-rooms": {
				title: "Постоянные комнаты",
				text: "Ваша компания друзей часто возвращается сюда? Избегите хлопот\nс отправкой новой ссылки каждый раз.. Постоянные\nкомнаты получают персональный URL-адрес.",
			},
			"dark-theme": {
				title: "Тёмная тема",
				text: "Смотрите нарезки из Vine поздно ночью?\nOpenTogetherTube имеет тёмную тему,\nтак что Ваши глаза не будут испытывать дискомфорт.",
			},
			"room-permissions": {
				title: "Настройка прав",
				text: "Устали от случайных придурков, приходящих в вашу комнату и\nдобавляющих кучу громких видео к Вашему сеансу\n прослушивания Lofi Hip-Hop? Просто запретите им добавлять видео.",
			},
			"voting-system": {
				title: "Система голосования",
				text: "Не можете решить, что будете смотреть дальше? Добавьте в вашу очередь воспроизведения\nсистему голосования, и да здравствует демократия!.",
			},
			"playlist-copying": {
				title: "Копирование плейлиста",
				text: "Добавляйте целые плейлисты или каналы\nв очередь, чтобы вам не пришлось\nдобавлять каждый файл по отдельности. Это лучший\nспособ просмотра группы видео с Вашими друзьями!"
			},
		},
		support: {
			title: "Поддержать разработку",
			description1:
				"OpenTogetherTube не существовал бы без поддержки таких прекрасных людей, как Вы.",
			description2:
				"Погрузитесь в разработку поделившись вашим кодом или идеями, или выразите поддержку став спонсором. Все пожервтования идут на оплату хостинга, на разработку OpenTogetherTube, и свободу OpenTogetherTube от рекламных баннеров.",
			how: "Как Я могу помочь?",
			sponsor: "Стать спонсором",
			contribute: "Посодействовать",
		},
	},
	"footer": {
		"disclaimer":
			"Дисклеймер: OpenTogetherTube никак не связан с TogetherTube и Watch2Gether.",
		"made-in": "Создан в Америке",
		"thanks-to": "Особая благодарность",
		"privacy-policy": "Конфиденциальность",
		"attribution": "Attribution",
	},
	"not-found": {
		title: "Страница не найдена",
		home: "@:nav.home",
		browse: "@:landing.hero.btns.browse",
	},
	"quick-room": {
		text: "Создаём временную комнату для вас...",
	},
	"attribution": {
		"sponsorblock-text": "Uses SponsorBlock data from",
	},
	"faq": {
		title: "Часто задаваемые вопросы",
		questions: [
			{
				question: "Какие типы видео могут быть добавлены?",
				answer: "Youtube, Vimeo, и Dailymotion, также могут быть добавлены прямые ссылки на видео, вроде .mp4 (иногда .webm).",
			},
			{
				question: "Вы можете добавить поддержку X?",
				answer: "Если X имеет iframe API, то да, если это возможно.",
			},
			{
				question: "Вы добавите поддержку X?",
				answer: "Может быть, зависит от запроса. Откройте тикет на Гитхабе или поддержите существующий, чтобы отразить Ваши интересы.",
			},
			{
				question: "Я хочу создать постоянную комнату с кастомным URL.",
				answer: "Вы можете создать такую кликнув на кнопку в правом верхнем углу экрана.",
			},
			{
				question:
					"Почему некоторые видео не имеют названия, или заставкки, но всё ещё могут быть проиграны?",
				answer: "Это может быть связано с тем, что сервер не может получить данную информацию из-за квот Youtube API.",
			},
			{
				question: 'Почему мне пишет "Out of quota" когда я ищу видео на YouTube?',
				answer: "Запросы к YouTube очень дорого осуществлять, из-за этого количество запросов ограничено. Если это происходит, просто найдите видео на YouTube и скопируйте ссылку.",
			},
			{
				question: "Как работают постоянные комнаты?",
				answer: 'На данный момент, постоянные комнаты лишь имеют кастомный URL-адрес, и кто угодно может к вам подключиться. Если Вы вошли в аккаунт, вы можете стать владельцем вечной комнаты, если у неё ещё нет владельца. Комнату можно сделать приватной, и только приглашённые пользователи могут попасть в неё. Это потребует наличие аккаунта у всех приглашённых, но это предотвратит случайное попадание в вашу комнату неавторизованных пользователей. Узнать прогресс разработки приватных комнат можно здесь: <a href="https://github.com/dyc3/opentogethertube/issues/261">dyc3/opentogethertube#261</a>',
			},
		],
	},
	"nav": {
		"home": "Главная",
		"browse": "Поиск",
		"faq": "FAQ",
		"bug": "Сообщить об ошибке",
		"support": "Поддержка",
		"login": "Вход",
		"link-discord": "Ссылка на Discord",
		"logout": "Выход",
		"create": {
			"title": "Созать комнату",
			"temp": "Создать временную комнату",
			"temp-desc": "Начните совместный просмотр как можно скорее.",
			"perm": "Создать постоянную комнату",
			"perm-desc": "Отлично подходит для постоянных посетителей сайта.",
		},
	},
	"room-list": {
		"no-rooms": "В данный момент комнат нет...",
		"create": "@:nav.create.title",
		"no-description": "Нет описания.",
		"nothing-playing": "Ничего не воспроизводится.",
	},
	"room": {
		"title-temp": "Временная комната",
		"kick-me": "Кикнуть",
		"rewind": "Отмотать на 10с",
		"skip": "Пропустить 10с",
		"play-pause": "Проигрывать/Пауза",
		"next-video": "Следующее видео",
		"toggle-fullscreen": "Полноэкранный режим",
		"con-status": {
			"connecting": "Подключение...",
			"connected": "Подключено",
			"failed": "Не удалось попасть в комнату",
			"find-another": "Поищите другую комнату",
		},
		"tabs": {
			queue: "Очередь",
			add: "Добавить",
			settings: "Настройки",
		},
		"users": {
			title: "Пользователи",
			set: "Выберите себе имя",
			empty: "Кажется, здесь никого нет. Пригласите своих друзей!",
			you: "Вы",
			demote: "Понизить",
			promote: "Повысить",
		},
	},
	"privacy": {
		title: "@:footer.privacy-policy",
		text1: "Этот сайт использует cookies. Также сайт использует Google Analytics, но отслеживается лишь меньшая часть информации. Единственный вид собираемой демографической информации - страна проживания, используете ли Вы мобильное устройство, или же настольное. Собираемая информация никогда не будет связана с Вашим OTT аккаунтом или сессией. Если Вы не хотите чтобы информация собиралась, используйте AdBlock.",
		text2: 'Ваш IP не зарегистрирован в логах OpenTogetherTube\. IP записывается на короткий промежуток времени.\nЧаты не записываются. Любые видео, которые вы ищете, никогда не будут связаны с Вашим аккаунтом или сессией.',
		text3: "Обычное использование сайта, как создание комнаты, добавление видео, и т.д., регистрируется для мониторинга и логов. Логи не оставляются больше чем на неделю.\nСобытия в логах никак не связаны с Вашим аккаунтом или сессией..",
		text4: "Если у вас есть зарегистрированный аккаунт, Ваш email используется только для восстановления доступа к аккаунту, или для связи с Вами, если это необходимо. Email не требуется, если вы авторизуетесь через Discord. Ваш email, Ваши комнаты, и прочая Ваша информация - приватна, и никогда небудет предоставлена третьим лицам.",
		text5: {
			"text": "OpenTogetherTube использует GDPR. Если по какой-то причине вам нужна информация о Вашем аккаунте, свяжитесь со мной в",
			"link-text": "Twitter.",
		},
		text6: {
			"text1": "Сайт использует Youtube Data API, использование соответствует",
			"link-text1": "YouTube API Terms of Service",
			"text2":
				"Никакая персональная информация не отправляется в YouTube. Просмотр видео с YouTube требует от Вас соглашения с",
			"link-text2": "Youtube Terms of Service",
			"text3": "и",
			"link-text3": "Google's privacy policy",
		},
	},
	"chat": {
		"title": "Чат",
		"type-here": "Напишите Ваше сообщение здесь...",
	},
	"share-invite": {
		title: "Приглашение",
		text: "Скопируйте эту ссылку, и поделитесь ей с друзьями!!",
		copied: "Скопировано!",
	},
	"video": {
		"add-explanation": "Добавить в очередь.",
		"playnow": "Проиграть сейчас",
		"playnow-explanation":
			"Проиграть это видео сейчас, переместив текущее видео на верхнюю строчку очереди.",
		"no-video": "Ничего непроигрывается.",
		"no-video-text": 'Добавьте Ваше видео.',
	},
	"add-preview": {
		"add-all": "Добавить всё",
		"placeholder": "Воспользуйтесь поиском YouTube здесь, или вставьте URL видео, чтобы добавить его в очередь",
		"title": "Что я могу добавить?",
		"single-videos": "Видео",
		"playlists": "Плейлисты",
		"playlist": "Плейлист",
		"text": "Печатайте, чтобы воспользоваться поиском YouTube.",
		"search": "Поиск",
		"search-for": 'Ищите в YouTube "{search}" нажав Enter, или тыкнув на Поиск.',
		"platforms": {
			"youtube-videos": "YouTube видео: {url}",
			"vimeo-videos": "Vimeo видео: {url}",
			"dailymotion-videos": "Dailymotion видео: {url}",
			"any-mp4-videos": "Общедоступные .mp4 видео: {url}",
			"youtube-playlists": "YouTube плейлисты: {url}",
			"youtube-channels": "YouTube каналы: {url}",
			"subreddits": "Сабреддиты: {url}",
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
