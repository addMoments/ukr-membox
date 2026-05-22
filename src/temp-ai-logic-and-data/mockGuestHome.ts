// Stub data for guest home page - waiting for real API implementation

export interface RecentUpload {
  id: string;
  imageUrl: string;
  uploaderName: string;
  timeAgo: string;
}

// Mock recent uploads for the guest gallery section
export const getMockRecentUploads = (): RecentUpload[] => [
  {
    id: '1',
    imageUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=400&h=500&fit=crop',
    uploaderName: 'Alex M.',
    timeAgo: '2 mins ago'
  },
  {
    id: '2',
    imageUrl: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=400&h=500&fit=crop',
    uploaderName: 'Jessica',
    timeAgo: '5 mins ago'
  }
];

// Stub for event location - not in current Event type
export const getMockEventLocation = (): string => {
  return 'Event Location';
};
