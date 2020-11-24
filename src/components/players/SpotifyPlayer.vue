<template>
	<!-- eslint-disable-next-line vue/no-v-html -->
	<div id="spotify-player" class="spotify">
		<iframe
			id="spotify-player-iframe"
			src=""
			width="100%"
			height="100%"
			frameborder="0"
			allowtransparency="true"
			allow="encrypted-media">
		</iframe>
	</div>
</template>

<script src="https://sdk.scdn.co/spotify-player.js"></script>
<script>

const SPOTIFY_EMBED_URL="https://open.spotify.com/embed"
const SPOTIFY_WEB_API="https://api.spotify.com/v1/me/player"

export default {
	name: "SpotifyPlayer",
	props: {
		videoId: { type: String, required: true },
	},
	data() {
		return {
			player: null,
			player_iframe: null,
			device_id: null,
			token: null,
			
		};
	},
	created() {
		window.onSpotifyWebPlaybackSDKReady = () => {
  			this.token = process.env.SPOTIFY_WEB_API_TOKEN;
  			this.player = new Spotify.Player({
    			name: 'OpenTogetherTube',
    			getOAuthToken: cb => { cb(token); }
			});

		  this.player.addListener('ready', ({ device_id }) => {
    		this.device_id = device_id
		  });
		  player.connect().then(success => {
  			if (success) {
    			this.$emit('ready');
  			}
		  })
		};  
	},
	methods: {

		updateIframe() {
			this.player_iframe = document.getElementById("spotify-player-iframe")
			this.player_iframe.src = ""
		},
		getCurrent() {
			getCurrent = null
			player.getCurrentState().then(state => {
				let {
   					 current_track,
    				 next_tracks: [next_track]
					  } = state.track_window
				getCurrent = current_track	  
			});
			return current_track;
		},
		play() {
			this.player.resume()
		},
		pause() {
			this.player.pause()
		},
		getPosition() {
			return this.player.getCurrentState().position
		},
		setPosition(position) {
			return this.player.seek(position * 1000)
		},
		setVolume(volume) {
			this.player.setVolume(volume)
		},
		onReady() {
		},
	},
	watch: {
		videoId() {
			this.updateIframe();
			axios({
   				url: `${SPOTIFY_WEB_API}play?device_id=${this.device_id}`,
   				type: "PUT",
				data: `{"uris": ["spotify:${videoType}:${this.videoId}"]}`,
				headers: {
					'Accept': 'application/json',
					'Content-Type': 'application/json',
					'Authorization': `Bearer${this.token}`
				}
  			}).then((data) => {console.log(data)})
		},
	},
};
</script>

<style lang="scss" scoped>
.spotify-player {
	position: relative;
	padding-bottom: 56.25%;
	height: 0;
	overflow: hidden;
	max-width: 100%;

	iframe {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
	}
}
</style>
