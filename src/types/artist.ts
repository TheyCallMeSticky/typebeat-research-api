// Types pour les artistes et données musicales

export interface Artist {
  id: string;
  name: string;
  genres: string[];
  popularity?: number;
  images?: ImageObject[];
  external_urls?: ExternalUrls;
  followers?: FollowerInfo;
}

export interface ImageObject {
  url: string;
  height?: number;
  width?: number;
  size?: 'small' | 'medium' | 'large' | 'extralarge' | 'mega';
}

export interface ExternalUrls {
  spotify?: string;
  lastfm?: string;
  genius?: string;
}

export interface FollowerInfo {
  href?: string;
  total: number;
}

// Types spécifiques aux APIs externes

export interface SpotifyArtist extends Artist {
  spotify_id: string;
  uri: string;
  href: string;
  type: 'artist';
}

export interface LastFmArtist {
  name: string;
  mbid?: string;
  match: number; // Score de similarité 0-1
  url: string;
  image: ImageObject[];
  streamable: boolean;
}

export interface YouTubeVideo {
  id: string;
  title: string;
  channelTitle: string;
  publishedAt: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  duration?: string;
  thumbnails: {
    default: ImageObject;
    medium: ImageObject;
    high: ImageObject;
  };
}

export interface GeniusArtist {
  id: number;
  name: string;
  url: string;
  image_url?: string;
  header_image_url?: string;
  description?: string;
}

// Types pour les filtres de recherche

export interface SearchFilters {
  genre?: string;
  bpm_range?: [number, number];
  region?: string;
  popularity_range?: [number, number];
  min_similarity?: number;
}

// Types pour les métadonnées enrichies

export interface ArtistMetadata {
  artist: Artist;
  bpm?: number;
  region?: string;
  label?: string;
  collaborators?: string[];
  producers?: string[];
  tags?: string[];
  last_updated: Date;
}

