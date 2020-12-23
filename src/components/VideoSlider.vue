<template>
  <h1 id="placeholder">{{ placeholder }}</h1>
</template>

<script>
export default {
    name: "VideoSlider",
    props: {
		hoverMetrics: { type: Boolean, default: false },
	},
    data() {
        //just a placeholder for now
        //another placeholder
        return {
            placeholder: "Hello World",
        };
    },
};
</script>

<style lang="scss" scoped>
@import "../variables.scss";

#placeholder {
    color: $brand-color;
}
 
</style>
