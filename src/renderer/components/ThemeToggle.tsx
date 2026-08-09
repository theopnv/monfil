import { Button } from '@/components/untitled-ui/base/buttons/button';
import { Moon01, Sun } from "@untitledui/icons";
import { useTheme } from '@/providers/theme-provider';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
        aria-label="Toggle theme"
        color="tertiary"
        size="sm"
        iconLeading={resolvedTheme === "light" ? Moon01 : Sun}
        onPress={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
    />
  );
}
