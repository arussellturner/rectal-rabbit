/**
 * How each world looks. Every level picks one of these; the level art in
 * src/art/pixelTextures.ts is painted in these colors.
 */
export type ThemeId = 'snow' | 'forest' | 'desert' | 'jungle' | 'cave' | 'volcano';

export interface Theme {
  id: ThemeId;
  /** Sky (or cave gloom), top to bottom, in bands like an NES. */
  sky: number[];
  /** Speckled ground: base, light, dark. */
  ground: [string, string, string];
  /** Pebbles in the ground: light, mid, dark. */
  pebbles: [string, string, string];
  root: string;
  /** What sits on top of open ground: snow drifts, a grass fringe, sand, a crust. */
  cap: { style: 'drift' | 'grass' | 'sand' | 'crust'; main: string; shade: string };
  /** 'S' tiles. */
  ledge: { base: string; light: string; dark: string; accent: string };
  /** 'X' tiles. */
  block: { style: 'bevel' | 'crate' | 'carved'; base: string; light: string; dark: string; edge: string; shine: string };
  /** '=' tiles. */
  bridge: { style: 'log' | 'vine'; top: string; base: string; dark: string };
  /** Grass tuft colors. */
  grass: [string, string, string];
  /** '~' tiles: top, middle, deep. */
  liquid: { name: string; top: string; base: string; deep: string };
  /** The far-away scenery. */
  far: { kind: 'peaks' | 'dunes' | 'volcano' | 'none'; color: string; shade: string; cap: string; capShade: string };
  /** The closer silhouettes. Stalactites hang from the top of the screen. */
  mid: { kind: 'pines' | 'oaks' | 'mesas' | 'canopy' | 'stalactites' | 'crags'; color: string };
  /** Scenery standing on the ground here and there. */
  deco: 'pine' | 'oak' | 'cactus' | 'palm' | 'crystal' | 'deadtree';
  clouds: { main: string; shade: string } | null;
  weather: 'snow' | 'leaves' | 'sand' | 'drips' | 'embers';
  /** Light text color that stands out against this sky. */
  accent: string;
}

export const THEMES: Record<ThemeId, Theme> = {
  snow: {
    id: 'snow',
    sky: [0x183c8c, 0x24509c, 0x3464b4, 0x4c7ccc, 0x6c98dc, 0x94b8e8],
    ground: ['#88581c', '#ac7c3c', '#5c3a10'],
    pebbles: ['#bcbcbc', '#7c7c7c', '#3c3c3c'],
    root: '#503000',
    cap: { style: 'drift', main: '#fcfcfc', shade: '#a4e4fc' },
    ledge: { base: '#7c7c7c', light: '#bcbcbc', dark: '#3c3c3c', accent: '#58a838' },
    block: { style: 'bevel', base: '#3cbcfc', light: '#a4e4fc', dark: '#0078f8', edge: '#0000bc', shine: '#fcfcfc' },
    bridge: { style: 'log', top: '#fca044', base: '#ac7c00', dark: '#503000' },
    grass: ['#00a800', '#58d854', '#005800'],
    liquid: { name: 'ICY WATER', top: '#fcfcfc', base: '#3cbcfc', deep: '#0078f8' },
    far: { kind: 'peaks', color: '#3c50a8', shade: '#283c8c', cap: '#fcfcfc', capShade: '#bcbcbc' },
    mid: { kind: 'pines', color: '#1c3470' },
    deco: 'pine',
    clouds: { main: '#fcfcfc', shade: '#a4e4fc' },
    weather: 'snow',
    accent: '#fce0a8',
  },
  forest: {
    id: 'forest',
    sky: [0x3c7cdc, 0x5090e4, 0x64a4ec, 0x7cb8f0, 0x9cccf4, 0xbce0f8],
    ground: ['#7c4c1c', '#9c6c34', '#4c2c0c'],
    pebbles: ['#a8a8a8', '#6c6c6c', '#343434'],
    root: '#3c2008',
    cap: { style: 'grass', main: '#58b834', shade: '#2c7c1c' },
    ledge: { base: '#6c5c4c', light: '#9c8c74', dark: '#3c3024', accent: '#58b834' },
    block: { style: 'crate', base: '#ac7c3c', light: '#d8a85c', dark: '#6c4418', edge: '#3c2008', shine: '#f0c87c' },
    bridge: { style: 'log', top: '#d8a85c', base: '#8c5c24', dark: '#4c2c0c' },
    grass: ['#3c9c1c', '#7cd04c', '#1c5c0c'],
    liquid: { name: 'RIVER', top: '#d8f4fc', base: '#2c8cdc', deep: '#1c5cac' },
    far: { kind: 'peaks', color: '#4c8c7c', shade: '#3c7064', cap: '#6cac8c', capShade: '#5c9c7c' },
    mid: { kind: 'oaks', color: '#2c6c3c' },
    deco: 'oak',
    clouds: { main: '#fcfcfc', shade: '#d8ecf8' },
    weather: 'leaves',
    accent: '#fce0a8',
  },
  desert: {
    id: 'desert',
    sky: [0xe8743c, 0xf08c4c, 0xf4a45c, 0xf8bc74, 0xfcd090, 0xfce4b0],
    ground: ['#d8a45c', '#ecc07c', '#b07c3c'],
    pebbles: ['#fce4b0', '#c8945c', '#8c5c2c'],
    root: '#8c5c2c',
    cap: { style: 'sand', main: '#fce0a0', shade: '#ecc07c' },
    ledge: { base: '#c0743c', light: '#e8a060', dark: '#7c4420', accent: '#fcd090' },
    block: { style: 'crate', base: '#9c6c34', light: '#c8945c', dark: '#5c3a10', edge: '#3c2008', shine: '#e0b07c' },
    bridge: { style: 'log', top: '#e0b07c', base: '#9c6c34', dark: '#5c3a10' },
    grass: ['#8ca83c', '#b8c860', '#5c7424'],
    liquid: { name: 'QUICKSAND', top: '#c8945c', base: '#8c5c2c', deep: '#5c3a10' },
    far: { kind: 'dunes', color: '#e8a868', shade: '#d08c50', cap: '#f4c084', capShade: '#e8a868' },
    mid: { kind: 'mesas', color: '#b0603c' },
    deco: 'cactus',
    clouds: { main: '#fcf0dc', shade: '#fcd8a8' },
    weather: 'sand',
    accent: '#ffffff',
  },
  jungle: {
    id: 'jungle',
    sky: [0x1c6c5c, 0x24806c, 0x34947c, 0x4ca88c, 0x6cbc9c, 0x94d0b0],
    ground: ['#5c3c1c', '#7c5430', '#3c2410'],
    pebbles: ['#8c9c7c', '#5c6c4c', '#2c3424'],
    root: '#2c1c08',
    cap: { style: 'grass', main: '#2c9c3c', shade: '#1c6c24' },
    ledge: { base: '#7c847c', light: '#a8b0a0', dark: '#3c443c', accent: '#3cbc4c' },
    block: { style: 'carved', base: '#8c947c', light: '#b4bca0', dark: '#4c5444', edge: '#2c3024', shine: '#3cbc4c' },
    bridge: { style: 'vine', top: '#5cd04c', base: '#2c8c2c', dark: '#1c4c14' },
    grass: ['#1c8c2c', '#4cc04c', '#0c4c14'],
    liquid: { name: 'SWAMP', top: '#9ce0a0', base: '#2c7c5c', deep: '#1c4c3c' },
    far: { kind: 'peaks', color: '#2c7464', shade: '#1c5c4c', cap: '#3c8c74', capShade: '#2c7464' },
    mid: { kind: 'canopy', color: '#14483c' },
    deco: 'palm',
    clouds: null,
    weather: 'leaves',
    accent: '#fce0a8',
  },
  cave: {
    id: 'cave',
    sky: [0x08081c, 0x0c1028, 0x101834, 0x142040, 0x18284c, 0x1c3058],
    ground: ['#4c5c7c', '#6c7c9c', '#2c3450'],
    pebbles: ['#a4e4fc', '#6c8cbc', '#1c2440'],
    root: '#2c3450',
    cap: { style: 'crust', main: '#a4e4fc', shade: '#3cbcfc' },
    ledge: { base: '#7c4cbc', light: '#b48cec', dark: '#3c1c7c', accent: '#fcb4fc' },
    block: { style: 'bevel', base: '#3cbcfc', light: '#a4e4fc', dark: '#0078f8', edge: '#0000bc', shine: '#fcfcfc' },
    bridge: { style: 'log', top: '#a4e4fc', base: '#6c8cbc', dark: '#2c3c6c' },
    grass: ['#3cbc9c', '#7cecbc', '#1c7c64'],
    liquid: { name: 'ICY WATER', top: '#d8f8fc', base: '#2c7cbc', deep: '#1c4c8c' },
    far: { kind: 'none', color: '#000000', shade: '#000000', cap: '#000000', capShade: '#000000' },
    mid: { kind: 'stalactites', color: '#24304c' },
    deco: 'crystal',
    clouds: null,
    weather: 'drips',
    accent: '#a4e4fc',
  },
  volcano: {
    id: 'volcano',
    sky: [0x24081c, 0x3c0c24, 0x58142c, 0x781c2c, 0x9c2c24, 0xc04c1c],
    ground: ['#4c3c3c', '#6c5454', '#2c2020'],
    pebbles: ['#9c7c74', '#5c4444', '#1c1010'],
    root: '#f87800',
    cap: { style: 'crust', main: '#8c8c8c', shade: '#5c5c5c' },
    ledge: { base: '#2c2434', light: '#54485c', dark: '#100c14', accent: '#f87800' },
    block: { style: 'carved', base: '#5c4c4c', light: '#7c6c6c', dark: '#2c2020', edge: '#140c0c', shine: '#f8a040' },
    bridge: { style: 'log', top: '#7c6c6c', base: '#4c3c3c', dark: '#1c1414' },
    grass: ['#7c9c2c', '#a8c040', '#4c6418'],
    liquid: { name: 'LAVA', top: '#fce048', base: '#f87800', deep: '#c83000' },
    far: { kind: 'volcano', color: '#3c2024', shade: '#2c1418', cap: '#f87800', capShade: '#c83000' },
    mid: { kind: 'crags', color: '#1c0c14' },
    deco: 'deadtree',
    clouds: { main: '#5c4c54', shade: '#3c2c34' },
    weather: 'embers',
    accent: '#fce048',
  },
};
