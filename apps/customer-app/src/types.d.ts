declare module 'expo-image-picker' {
  export const MediaTypeOptions: { Images: string; Videos: string; All: string };
  export function launchImageLibraryAsync(options?: {
    mediaTypes?: string;
    quality?: number;
    allowsEditing?: boolean;
  }): Promise<{
    canceled: boolean;
    assets: Array<{ uri: string; width: number; height: number }>;
  }>;
  export function launchCameraAsync(options?: {
    mediaTypes?: string;
    quality?: number;
  }): Promise<{
    canceled: boolean;
    assets: Array<{ uri: string; width: number; height: number }>;
  }>;
}
