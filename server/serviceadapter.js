class ServiceAdapter {
  /**
   * A string that identifies this service adapter.
   */
  get serviceId() {
    throw `Service adapter ${this.constructor.name} does not implement the serviceId getter`;
  }

  /**
   * Returns true if this service adapter can handle a given link.
   * @param {string} link
   * @returns {boolean}
   */
  canHandleLink() {
    return false;
  }
}

module.exports = ServiceAdapter;
