class ServiceAdapter {
  /**
   * A string that identifies this service adapter.
   */
  get serviceId() {
    if (this.constructor.SERVICE_ID == null) {
      throw `Service adapter ${this.constructor.name} does not have a static SERVICE_ID property`;
    }

    return this.constructor.SERVICE_ID;
  }

  /**
   * A boolean that indicates whether video metadata can be safely cached.
   * @returns {boolean}
   */
  get isCacheSafe() {
    return true;
  }

  /**
   * Returns true if this service adapter can handle a given link.
   * @param {string} link
   * @returns {boolean}
   */
  canHandleLink() {
    return false;
  }

  /**
   * Fetches video metadata from the API.
   * @param {string} videoId
   * @returns {Promise}
   */
  getVideoInfo(videoId, onlyProperties) {
    return this._getVideoInfo(videoId, onlyProperties);
  }
}

module.exports = ServiceAdapter;
