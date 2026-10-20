import type {HudCue} from './HudStateAdapter';
const base=import.meta.env.BASE_URL;
export const animationRegistry:Record<HudCue,string>={
  mode:`${base}animations/transition.json`,success:`${base}animations/success.json`,
  warning:`${base}animations/warning.json`,brake:`${base}animations/warning.json`,
  reverse:`${base}animations/transition.json`,jump:`${base}animations/transition.json`,
  sprint:`${base}animations/transition.json`,interaction:`${base}animations/success.json`,
};
