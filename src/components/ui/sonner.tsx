
import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      visibleToasts={1}
      duration={3500}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl group-[.toaster]:pl-4 group-[.toaster]:pr-8 group-[.toaster]:py-4 group-[.toaster]:border-l-4 group-[.toaster]:border-l-worksheet-purple",
          title: "group-[.toast]:font-semibold group-[.toast]:text-base",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-sm",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toast]:border-l-green-500 group-[.toast]:animate-in group-[.toast]:fade-in-50 group-[.toast]:slide-in-from-right-10",
          error: "group-[.toast]:border-l-red-500 group-[.toast]:animate-in group-[.toast]:fade-in-50 group-[.toast]:slide-in-from-right-10",
          warning: "group-[.toast]:border-l-yellow-500 group-[.toast]:animate-in group-[.toast]:fade-in-50 group-[.toast]:slide-in-from-right-10",
          info: "group-[.toast]:border-l-blue-500 group-[.toast]:animate-in group-[.toast]:fade-in-50 group-[.toast]:slide-in-from-right-10",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
