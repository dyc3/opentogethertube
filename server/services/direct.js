const URL = require("url");
const ServiceAdapter = require("../serviceadapter");

class DirectVideoAdapter extends ServiceAdapter {
  static SERVICE_ID = "direct";

  get isCacheSafe() {
    return false;
  }

  canHandleLink(link) {
    const url = URL.parse(link);
    return /\/*\.(mp4(|v)|mpg4|webm|flv|mkv|avi|wmv|qt|mov|ogv|m4v|h26[1-4])$/.exec(
      url.path.split("?")[0]
    );
  }
}

module.exports = DirectVideoAdapter;
