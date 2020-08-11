const { IncompleteServiceAdapterException } = require("./exceptions");

class ServiceAdapter {
  /**
   * A string that identifies this service adapter.
   */
  get serviceId() {
    if (this.constructor.SERVICE_ID == null) {
      throw new IncompleteServiceAdapterException(`Service adapter ${this.constructor.name} does note have a serviceId property`);
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
   * Determines whether a given URL points to a collection of videos.
   * @param {string} url
   * @returns {boolean}
   */
  isCollectionURL() {
    throw new IncompleteServiceAdapterException(`Service ${this.serviceId} does not implement method isCollectionURL`);
  }

  /**
   * Returns the video ID from a URL.
   * @param {string} url
   * @returns {string}
   */
  getVideoId() {
    throw new IncompleteServiceAdapterException(`Service ${this.serviceId} does not implement method getVideoId`);
  }

  /**
   * Fetches video metadata from the API.
   * @param {string} url
   * @param {string[]} properties
   * @returns {Promise}
   */
  fetchVideoInfo() {
    throw new IncompleteServiceAdapterException(`Service ${this.serviceId} does not implement method getVideoInfo`);
  }

  /**
   * Fetches video metadata for a list of IDs.
   * @param {Array} requests List of objects with id and missingInfo keys
   * @returns {Promise}
   */
  fetchManyVideoInfo() {
    throw new IncompleteServiceAdapterException(`Service ${this.serviceId} does not implement method getManyVideoInfo`);
  }

  /**
   * Fetches all videos associated with a URL.
   * @param {string} url
   * @param {string[]} properties
   * @returns {Promise}
   */
  resolveURL() {
    throw new IncompleteServiceAdapterException(`Service ${this.serviceId} does not implement method resolveURL`);
  }

  /**
   * Searches a video service.
   * @param {string} query
   * @returns {Promise}
   */
  searchVideos() {
    return [];
  }
}

module.exports = ServiceAdapter;
