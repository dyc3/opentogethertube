/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-unused-vars */
import { Video, VideoId, VideoMetadata } from "../common/models/video";
import { IncompleteServiceAdapterException } from "./exceptions";

export interface VideoRequest {
  id: string,
  missingInfo: (keyof VideoMetadata)[]
}

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
   */
  canHandleURL(link: string): boolean {
    return false;
  }

  /**
   * Determines whether a given URL points to a collection of videos.
   */
  isCollectionURL(url: string): boolean {
    throw new IncompleteServiceAdapterException(`Service ${this.serviceId} does not implement method isCollectionURL`);
  }

  /**
   * Returns the video ID from a URL.
   */
  getVideoId(url: string): string {
    throw new IncompleteServiceAdapterException(`Service ${this.serviceId} does not implement method getVideoId`);
  }

  /**
   * Fetches video metadata from the API.
   * @param {string} url
   * @param {string[]} properties
   */
  fetchVideoInfo(url: string, properties?: (keyof VideoMetadata)[]): Promise<Video> {
    throw new IncompleteServiceAdapterException(`Service ${this.serviceId} does not implement method getVideoInfo`);
  }

  /**
   * Fetches video metadata for a list of IDs.
   * @param requests List of objects with id and missingInfo keys
   */
  fetchManyVideoInfo(requests: VideoRequest[]): Promise<Video[]> {
    throw new IncompleteServiceAdapterException(`Service ${this.serviceId} does not implement method getManyVideoInfo`);
  }

  /**
   * Fetches all videos associated with a URL.
   */
  resolveURL(url: string, properties?: (keyof VideoMetadata)[]): Promise<Video[] | { url: string }[]> {
    throw new IncompleteServiceAdapterException(`Service ${this.serviceId} does not implement method resolveURL`);
  }

  /**
   * Searches a video service.
   * @param {string} query
   */
  async searchVideos(query: string): Promise<Video[]> {
    return [];
  }
}
