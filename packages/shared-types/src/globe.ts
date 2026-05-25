export interface BannerScore {
  total: number;
  relevance?: number;
  engagement?: number;
}

export interface GlobeBanner {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  imageUrl?: string;
  score?: BannerScore;
  metadata?: Record<string, any>;
}

export interface CameraState {
  latitude: number;
  longitude: number;
  altitude: number;
  heading?: number;
  pitch?: number;
  roll?: number;
}

export interface SearchWeights {
  relevance: number;
  recency: number;
  popularity: number;
  proximity?: number;
}

export interface Region {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
}

// WebView bridge message types
export type WebViewMessage =
  | { type: 'BANNERS_UPDATE'; payload: GlobeBanner[] }
  | { type: 'SEARCH_WEIGHTS'; payload: SearchWeights }
  | { type: 'BANNER_TAPPED'; payload: { bannerId: string } }
  | { type: 'CAMERA_MOVED'; payload: CameraState }
  | { type: 'REGION_CHANGED'; payload: Region }
  | { type: 'CAMERA_SET'; payload: CameraState };
