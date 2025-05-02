import { useThemeName } from 'tamagui';

export const useAppColors = () => {
  const themeName = useThemeName();

    const bg = themeName === 'dark' ? '#250047' : '#F2E8FF';     // background
    const pc = themeName === 'dark' ? '#E8004D' : '#3E0094';     // primary color
    const tc = themeName === 'dark' ? '#F2E8FF' : '#26004E';     // text color
    const stc = '#9D9D9D';                                       // subtext (same for both)
    const green = themeName === 'dark' ? '#00FF6A' : '#34A853';  // green
    const red = themeName === 'dark' ? 'black' : '#E8004D'       // red is actually black on dark mode due to similarity of pc


  return {
    themeName,
    bg,
    pc,
    tc,
    stc,
    green,
    red,
  };
};
