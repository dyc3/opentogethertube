# Custom Media Metadata

OpenTogetherTube supports adding custom audio/video content by allowing users to supply a direct URL to an audio/video file. However, supplying a single file limits the ability to provide multiple source URLs with varying bitrates or resolutions, and it does not allow for providing text tracks for subtitles/closed captioning or image URLs for thumbnails.

To overcome these limitations, OpenTogetherTube supports a custom media provider manifest. This allows users to provide a JSON manifest specifying the metadata for custom content, enabling multiple qualities and external text tracks.

## Custom Manifest URLs

Custom media manifests can be added to OpenTogetherTube by pasting a link to a public URL hosting the JSON metadata manifest into the room's playlist.

Valid JSON manifests must:
* Have a URL path ending with the file extension `.json` (not counting query string parameters).
* Be served with the `Content-Type` header set to `application/json`.
* Be publicly accessible.

## Manifest Format

The root JSON object describing the media must contain the following keys:

* `title`: A non-empty string specifying the title of the content (max 100 characters).
* `duration`: A non-negative, finite number specifying the duration, in seconds, of the content.
* `live`: An optional boolean (default: `false`) indicating whether the content is live or pre-recorded. Currently, the only supported value is `false`.
* `thumbnail`: An optional string specifying a valid URL for a thumbnail image of the content.
* `sources`: A non-empty list of playable sources for the content. The format is described below.
* `textTracks`: An optional list of text tracks for subtitles or closed captioning. The format is described below.

### Source Format

Each source entry in the `sources` array is a JSON object with the following keys:

* `url`: A valid HTTPS URL that browsers can use to retrieve the content.
* `contentType`: A string representing the MIME type of the content at `url`. Supported values are:
  * `video/mp4`
  * `video/x-matroska`
  * `video/webm`
  * `video/ogg`
* `quality`: A positive number representing the quality/resolution level of the source (e.g., `1080`, `720`, `480`).
* `bitrate`: An optional positive number indicating the bitrate of the content.

### Text Track Format

Each text track entry in the `textTracks` array is a JSON object with the following keys:

* `url`: A valid HTTPS URL that browsers can use to retrieve the track.
* `contentType`: A string representing the MIME type of the track. Currently, the only supported MIME type is `text/vtt`.
* `name`: An optional string (max 20 characters) providing a display name for the text track.
* `srclang`: A string (2-8 characters) indicating the language of the text track (e.g., `en`, `es`).
* `default`: An optional boolean indicating whether this subtitle track should be enabled by default.

**Important note regarding text tracks and CORS:**
Browsers block requests for WebVTT tracks hosted on different domains than the current page by default. To make text tracks work cross-origin, your host needs to serve the VTT file with the `Access-Control-Allow-Origin` HTTP header.

## Example

```json
{
  "title": "Movie Trailer",
  "duration": 125,
  "live": false,
  "thumbnail": "https://example.com/thumb.jpg",
  "sources": [
    {
      "url": "https://example.com/video-1080p.mp4",
      "contentType": "video/mp4",
      "quality": 1080,
      "bitrate": 5000
    },
    {
      "url": "https://example.com/video-720p.mp4",
      "contentType": "video/mp4",
      "quality": 720,
      "bitrate": 2500
    }
  ],
  "textTracks": [
    {
      "url": "https://example.com/subtitles_en.vtt",
      "contentType": "text/vtt",
      "name": "English",
      "srclang": "en",
      "default": true
    },
    {
      "url": "https://example.com/subtitles_es.vtt",
      "contentType": "text/vtt",
      "name": "Español",
      "srclang": "es"
    }
  ]
}
```
