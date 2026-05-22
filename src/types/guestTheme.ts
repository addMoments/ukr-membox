export type GuestTheme = Record<string, string>

export const defaultGuestTheme: GuestTheme = {
  '--base': '#FAFAF9',
  '--base-card': '#ffffff',
  '--text': '#1C1917',
  '--text-secondary': '#71716A',
  '--text-tertiary': '#a8a29e',
  '--primary': '#D5E553',
  '--primary-hover': '#C7D748',
  '--primary-text': '#1C1917',
  '--secondary': '#D2E823',
  '--secondary-hover': '#c4da1f',
  '--secondary-text': '#254f1a',
  '--border': '#f3f4f6',
}

export const getFormName = (key: string)=>{
    let name = key.replaceAll("--", "").replaceAll("-", " ");
    return name;
}

export interface AdminTheme {
    colors: GuestTheme;
    name: string;
    tag: string;
    displayColor: string;
}

export const cleanSlateTheme: GuestTheme = {
    '--base': '#F5F5F4',
    '--base-card': '#FAFAFA',
    '--text': '#3F3F46',
    '--text-secondary': '#71717A',
    '--text-tertiary': '#A1A1AA',
    '--primary': '#E4E4E7',
    '--primary-hover': '#D4D4D8',
    '--primary-text': '#3F3F46',
    '--secondary': '#A8B5A0',
    '--secondary-hover': '#96A68D',
    '--secondary-text': '#3F3F46',
    '--border': '#E4E4E7',
}

export const midnightSkyTheme: GuestTheme = {
    '--base': '#0C0A1D',
    '--base-card': '#161330',
    '--text': '#F4F0FF',
    '--text-secondary': '#B8B0D4',
    '--text-tertiary': '#6E6494',
    '--primary': '#2D2654',
    '--primary-hover': '#3D3470',
    '--primary-text': '#F4F0FF',
    '--secondary': '#D4AF37',
    '--secondary-hover': '#E5C355',
    '--secondary-text': '#0C0A1D',
    '--border': '#2D2654',
}

export const adminThemes: AdminTheme[] = [
    {
        name: "Golden Hour",
        tag: "sunset",
        displayColor: "#D5E553",
        colors: defaultGuestTheme
    },
    {
        name: "Clean Slate",
        tag: "minimal",
        displayColor: "#F8F9FA",
        colors: cleanSlateTheme
    },
    {
        name: "Midnight Sky",
        tag: "night",
        displayColor: "#1c1917",
        colors: midnightSkyTheme
    }
]