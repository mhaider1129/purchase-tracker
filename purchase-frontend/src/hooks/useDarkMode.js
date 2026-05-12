import { useTheme } from "../theme/ThemeProvider";

const useDarkMode = () => {
  const { isDarkMode, cycleTheme } = useTheme();
  return [isDarkMode, cycleTheme];
};

export default useDarkMode;