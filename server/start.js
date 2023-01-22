const tsnode = require("ts-node");
tsnode.register({
	transpileOnly: true,
});
require("./app.ts");
