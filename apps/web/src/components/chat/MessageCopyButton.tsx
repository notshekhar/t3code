import { memo } from "react";
import { CopyIcon, CheckIcon } from "lucide-react";
import { Button, type buttonVariants } from "../ui/button";
import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import { cn } from "~/lib/utils";
import type { VariantProps } from "class-variance-authority";

type ButtonSize = VariantProps<typeof buttonVariants>["size"];
type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];

export const MessageCopyButton = memo(function MessageCopyButton({
  text,
  variant = "outline",
  size = "xs",
  className,
}: {
  text: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const { copyToClipboard, isCopied } = useCopyToClipboard();

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={cn(className)}
      onClick={() => copyToClipboard(text)}
      title="Copy message"
      aria-label="Copy message"
    >
      {isCopied ? <CheckIcon className="size-3 text-success" /> : <CopyIcon className="size-3" />}
    </Button>
  );
});
