const URL = require("url");
const ServiceAdapter = require("../serviceadapter");

class GoogleDriveAdapter extends ServiceAdapter {
  static SERVICE_ID = "googledrive";

  canHandleLink(link) {
    const url = URL.parse(link);
    return url.host.endsWith("drive.google.com");
  }
}

module.exports = GoogleDriveAdapter;
