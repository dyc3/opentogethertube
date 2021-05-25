import { Video, VideoId } from "../common/models/video";
import { IncompleteServiceAdapterException } from "./exceptions";

export class ServiceAdapter {
  /**
   * A string that identifies this service adapter.
   */
  get serviceId(): string {
    throw new IncompleteServiceAdapterException(`Service adapter ${this.constructor.name} does note have a serviceId property`);
  }

  /**
   * A boolean that indicates whether video metadata can be safely cached.
   */
  get isCacheSafe(): boolean {
    return true;
  }

  /**
   * Returns true if this service adapter can handle a given link.
   * @param {string} link
   */
  canHandleURL(): boolean {
    return false;
  }

  /**
   * Determines whether a given URL points to a collection of videos.
   * @param {string} url
   */
  isCollectionURL(): boolean {
    throw new IncompleteServiceAdapterException(`Service ${this.serviceId} does not implement method isCollectionURL`);
  }

  /**
   * Returns the video ID from a URL.
   * @param {string} url
   */
  getVideoId(): string {
    throw new IncompleteServiceAdapterException(`Service ${this.serviceId} does not implement method getVideoId`);
  }

  /**
   * Fetches video metadata from the API.
   * @param {string} url
   * @param {string[]} properties
   */
  fetchVideoInfo(): Promise<Video> {
    throw new IncompleteServiceAdapterException(`Service ${this.serviceId} does not implement method getVideoInfo`);
  }

  /**
   * Fetches video metadata for a list of IDs.
   * @param {VideoId[]} requests List of objects with id and missingInfo keys
   */
  fetchManyVideoInfo(): Promise<Video[]> {
    throw new IncompleteServiceAdapterException(`Service ${this.serviceId} does not implement method getManyVideoInfo`);
  }

  /**
   * Fetches all videos associated with a URL.
   * @param {string} url
   * @param {string[]} properties
   */
  resolveURL(): Promise<Video[]> {
    throw new IncompleteServiceAdapterException(`Service ${this.serviceId} does not implement method resolveURL`);
  }

  /**
   * Searches a video service.
   * @param {string} query
   */
  async searchVideos(): Promise<Video[]> {
    return [];
  }
}
