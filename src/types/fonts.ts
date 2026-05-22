

export interface Font {
  name: string;
  url: string;
  id: string;
  fontFamily: string;
}

export const fonts: Font[] = [
  {
    name: 'Modern Sans',
    id: 'modern',
    url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    fontFamily: '"Inter", sans-serif',
  },
  {
    name: 'Classic Serif',
    id: 'classic',
    url: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&display=swap',
    fontFamily: '"Lora", serif',
  },
  {
    name: 'Grotesk Bold',
    id: 'grotesk',
    url: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap',
    fontFamily: '"DM Sans", sans-serif',
  }
];