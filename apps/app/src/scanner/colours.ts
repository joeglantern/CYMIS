import type { ColourName } from '@cymis/schemas';

/** The box colours crews pick from. The first six cover most of a yard. */
export const COLOURS: { id: ColourName; name: string; hex: string }[] = [
  { id: 'black', name: 'Black', hex: '#1b1b1a' },
  { id: 'grey', name: 'Grey', hex: '#8f8d88' },
  { id: 'white', name: 'White', hex: '#f4f3ef' },
  { id: 'blue', name: 'Blue', hex: '#2d4bb9' },
  { id: 'red', name: 'Red', hex: '#b3261e' },
  { id: 'green', name: 'Green', hex: '#2f6b45' },
  { id: 'maroon', name: 'Maroon', hex: '#6b1f2a' },
  { id: 'orange', name: 'Orange', hex: '#d9661f' },
  { id: 'yellow', name: 'Yellow', hex: '#f2c230' },
  { id: 'brown', name: 'Brown', hex: '#7a4e2d' },
];
