const URL = require("url");
const ServiceAdapter = require("../serviceadapter");

class DailyMotionAdapter extends ServiceAdapter {
  get serviceId() {
    return "dailymotion";
  }

  canHandleLink(link) {
    const url = URL.parse(link);
    return url.host.endsWith("dailymotion.com") || url.host.endsWith("dai.ly");
  }
}

module.exports = DailyMotionAdapter;
