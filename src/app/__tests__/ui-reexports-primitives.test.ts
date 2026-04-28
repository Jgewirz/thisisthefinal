import { describe, it, expect } from 'vitest';

import {
  HoverCard as AppHoverCard,
  HoverCardContent as AppHoverCardContent,
  HoverCardTrigger as AppHoverCardTrigger,
} from '../components/ui/hover-card';

import {
  HoverCard as UiHoverCard,
  HoverCardContent as UiHoverCardContent,
  HoverCardTrigger as UiHoverCardTrigger,
} from '../../ui/components/ui/hover-card';
import { cn as UiCn } from '../../ui/components/ui/utils';
import { cn as AppCn } from '../components/ui/utils';
import { Button as AppButton, buttonVariants as AppButtonVariants } from '../components/ui/button';
import { Badge as AppBadge, badgeVariants as AppBadgeVariants } from '../components/ui/badge';
import { Separator as AppSeparator } from '../components/ui/separator';
import { Button as UiButton, buttonVariants as UiButtonVariants } from '../../ui/components/ui/button';
import { Badge as UiBadge, badgeVariants as UiBadgeVariants } from '../../ui/components/ui/badge';
import { Separator as UiSeparator } from '../../ui/components/ui/separator';
import { Input as AppInput } from '../components/ui/input';
import { Textarea as AppTextarea } from '../components/ui/textarea';
import {
  Card as AppCard,
  CardAction as AppCardAction,
  CardContent as AppCardContent,
  CardDescription as AppCardDescription,
  CardFooter as AppCardFooter,
  CardHeader as AppCardHeader,
  CardTitle as AppCardTitle,
} from '../components/ui/card';
import { Input as UiInput } from '../../ui/components/ui/input';
import { Textarea as UiTextarea } from '../../ui/components/ui/textarea';
import {
  Card as UiCard,
  CardAction as UiCardAction,
  CardContent as UiCardContent,
  CardDescription as UiCardDescription,
  CardFooter as UiCardFooter,
  CardHeader as UiCardHeader,
  CardTitle as UiCardTitle,
} from '../../ui/components/ui/card';
import { Label as AppLabel } from '../components/ui/label';
import { Skeleton as AppSkeleton } from '../components/ui/skeleton';
import { ScrollArea as AppScrollArea, ScrollBar as AppScrollBar } from '../components/ui/scroll-area';
import { Label as UiLabel } from '../../ui/components/ui/label';
import { Skeleton as UiSkeleton } from '../../ui/components/ui/skeleton';
import { ScrollArea as UiScrollArea, ScrollBar as UiScrollBar } from '../../ui/components/ui/scroll-area';
import {
  Tooltip as AppTooltip,
  TooltipContent as AppTooltipContent,
  TooltipProvider as AppTooltipProvider,
  TooltipTrigger as AppTooltipTrigger,
} from '../components/ui/tooltip';
import {
  Popover as AppPopover,
  PopoverAnchor as AppPopoverAnchor,
  PopoverContent as AppPopoverContent,
  PopoverTrigger as AppPopoverTrigger,
} from '../components/ui/popover';
import {
  Dialog as AppDialog,
  DialogClose as AppDialogClose,
  DialogContent as AppDialogContent,
  DialogDescription as AppDialogDescription,
  DialogFooter as AppDialogFooter,
  DialogHeader as AppDialogHeader,
  DialogOverlay as AppDialogOverlay,
  DialogPortal as AppDialogPortal,
  DialogTitle as AppDialogTitle,
  DialogTrigger as AppDialogTrigger,
} from '../components/ui/dialog';
import {
  Tooltip as UiTooltip,
  TooltipContent as UiTooltipContent,
  TooltipProvider as UiTooltipProvider,
  TooltipTrigger as UiTooltipTrigger,
} from '../../ui/components/ui/tooltip';
import {
  Popover as UiPopover,
  PopoverAnchor as UiPopoverAnchor,
  PopoverContent as UiPopoverContent,
  PopoverTrigger as UiPopoverTrigger,
} from '../../ui/components/ui/popover';
import {
  Dialog as UiDialog,
  DialogClose as UiDialogClose,
  DialogContent as UiDialogContent,
  DialogDescription as UiDialogDescription,
  DialogFooter as UiDialogFooter,
  DialogHeader as UiDialogHeader,
  DialogOverlay as UiDialogOverlay,
  DialogPortal as UiDialogPortal,
  DialogTitle as UiDialogTitle,
  DialogTrigger as UiDialogTrigger,
} from '../../ui/components/ui/dialog';
import {
  Alert as AppAlert,
  AlertDescription as AppAlertDescription,
  AlertTitle as AppAlertTitle,
} from '../components/ui/alert';
import {
  Tabs as AppTabs,
  TabsContent as AppTabsContent,
  TabsList as AppTabsList,
  TabsTrigger as AppTabsTrigger,
} from '../components/ui/tabs';
import {
  Sheet as AppSheet,
  SheetClose as AppSheetClose,
  SheetContent as AppSheetContent,
  SheetDescription as AppSheetDescription,
  SheetFooter as AppSheetFooter,
  SheetHeader as AppSheetHeader,
  SheetTitle as AppSheetTitle,
  SheetTrigger as AppSheetTrigger,
} from '../components/ui/sheet';
import {
  Alert as UiAlert,
  AlertDescription as UiAlertDescription,
  AlertTitle as UiAlertTitle,
} from '../../ui/components/ui/alert';
import {
  Tabs as UiTabs,
  TabsContent as UiTabsContent,
  TabsList as UiTabsList,
  TabsTrigger as UiTabsTrigger,
} from '../../ui/components/ui/tabs';
import {
  Sheet as UiSheet,
  SheetClose as UiSheetClose,
  SheetContent as UiSheetContent,
  SheetDescription as UiSheetDescription,
  SheetFooter as UiSheetFooter,
  SheetHeader as UiSheetHeader,
  SheetTitle as UiSheetTitle,
  SheetTrigger as UiSheetTrigger,
} from '../../ui/components/ui/sheet';
import { Progress as AppProgress } from '../components/ui/progress';
import {
  Avatar as AppAvatar,
  AvatarFallback as AppAvatarFallback,
  AvatarImage as AppAvatarImage,
} from '../components/ui/avatar';
import { AspectRatio as AppAspectRatio } from '../components/ui/aspect-ratio';
import { Progress as UiProgress } from '../../ui/components/ui/progress';
import {
  Avatar as UiAvatar,
  AvatarFallback as UiAvatarFallback,
  AvatarImage as UiAvatarImage,
} from '../../ui/components/ui/avatar';
import { AspectRatio as UiAspectRatio } from '../../ui/components/ui/aspect-ratio';
import { Checkbox as AppCheckbox } from '../components/ui/checkbox';
import {
  Collapsible as AppCollapsible,
  CollapsibleContent as AppCollapsibleContent,
  CollapsibleTrigger as AppCollapsibleTrigger,
} from '../components/ui/collapsible';
import { Switch as AppSwitch } from '../components/ui/switch';
import { Checkbox as UiCheckbox } from '../../ui/components/ui/checkbox';
import {
  Collapsible as UiCollapsible,
  CollapsibleContent as UiCollapsibleContent,
  CollapsibleTrigger as UiCollapsibleTrigger,
} from '../../ui/components/ui/collapsible';
import { Switch as UiSwitch } from '../../ui/components/ui/switch';
import { Slider as AppSlider } from '../components/ui/slider';
import { Toggle as AppToggle, toggleVariants as AppToggleVariants } from '../components/ui/toggle';
import {
  Breadcrumb as AppBreadcrumb,
  BreadcrumbEllipsis as AppBreadcrumbEllipsis,
  BreadcrumbItem as AppBreadcrumbItem,
  BreadcrumbLink as AppBreadcrumbLink,
  BreadcrumbList as AppBreadcrumbList,
  BreadcrumbPage as AppBreadcrumbPage,
  BreadcrumbSeparator as AppBreadcrumbSeparator,
} from '../components/ui/breadcrumb';
import { Slider as UiSlider } from '../../ui/components/ui/slider';
import { Toggle as UiToggle, toggleVariants as UiToggleVariants } from '../../ui/components/ui/toggle';
import {
  Breadcrumb as UiBreadcrumb,
  BreadcrumbEllipsis as UiBreadcrumbEllipsis,
  BreadcrumbItem as UiBreadcrumbItem,
  BreadcrumbLink as UiBreadcrumbLink,
  BreadcrumbList as UiBreadcrumbList,
  BreadcrumbPage as UiBreadcrumbPage,
  BreadcrumbSeparator as UiBreadcrumbSeparator,
} from '../../ui/components/ui/breadcrumb';
import {
  Accordion as AppAccordion,
  AccordionContent as AppAccordionContent,
  AccordionItem as AppAccordionItem,
  AccordionTrigger as AppAccordionTrigger,
} from '../components/ui/accordion';
import {
  AlertDialog as AppAlertDialog,
  AlertDialogAction as AppAlertDialogAction,
  AlertDialogCancel as AppAlertDialogCancel,
  AlertDialogContent as AppAlertDialogContent,
  AlertDialogDescription as AppAlertDialogDescription,
  AlertDialogFooter as AppAlertDialogFooter,
  AlertDialogHeader as AppAlertDialogHeader,
  AlertDialogOverlay as AppAlertDialogOverlay,
  AlertDialogPortal as AppAlertDialogPortal,
  AlertDialogTitle as AppAlertDialogTitle,
  AlertDialogTrigger as AppAlertDialogTrigger,
} from '../components/ui/alert-dialog';
import {
  Pagination as AppPagination,
  PaginationContent as AppPaginationContent,
  PaginationEllipsis as AppPaginationEllipsis,
  PaginationItem as AppPaginationItem,
  PaginationLink as AppPaginationLink,
  PaginationNext as AppPaginationNext,
  PaginationPrevious as AppPaginationPrevious,
} from '../components/ui/pagination';
import {
  Accordion as UiAccordion,
  AccordionContent as UiAccordionContent,
  AccordionItem as UiAccordionItem,
  AccordionTrigger as UiAccordionTrigger,
} from '../../ui/components/ui/accordion';
import {
  AlertDialog as UiAlertDialog,
  AlertDialogAction as UiAlertDialogAction,
  AlertDialogCancel as UiAlertDialogCancel,
  AlertDialogContent as UiAlertDialogContent,
  AlertDialogDescription as UiAlertDialogDescription,
  AlertDialogFooter as UiAlertDialogFooter,
  AlertDialogHeader as UiAlertDialogHeader,
  AlertDialogOverlay as UiAlertDialogOverlay,
  AlertDialogPortal as UiAlertDialogPortal,
  AlertDialogTitle as UiAlertDialogTitle,
  AlertDialogTrigger as UiAlertDialogTrigger,
} from '../../ui/components/ui/alert-dialog';
import {
  Pagination as UiPagination,
  PaginationContent as UiPaginationContent,
  PaginationEllipsis as UiPaginationEllipsis,
  PaginationItem as UiPaginationItem,
  PaginationLink as UiPaginationLink,
  PaginationNext as UiPaginationNext,
  PaginationPrevious as UiPaginationPrevious,
} from '../../ui/components/ui/pagination';
import { RadioGroup as AppRadioGroup, RadioGroupItem as AppRadioGroupItem } from '../components/ui/radio-group';
import {
  InputOTP as AppInputOTP,
  InputOTPGroup as AppInputOTPGroup,
  InputOTPSeparator as AppInputOTPSeparator,
  InputOTPSlot as AppInputOTPSlot,
} from '../components/ui/input-otp';
import {
  Table as AppTable,
  TableBody as AppTableBody,
  TableCaption as AppTableCaption,
  TableCell as AppTableCell,
  TableFooter as AppTableFooter,
  TableHead as AppTableHead,
  TableHeader as AppTableHeader,
  TableRow as AppTableRow,
} from '../components/ui/table';
import { RadioGroup as UiRadioGroup, RadioGroupItem as UiRadioGroupItem } from '../../ui/components/ui/radio-group';
import {
  InputOTP as UiInputOTP,
  InputOTPGroup as UiInputOTPGroup,
  InputOTPSeparator as UiInputOTPSeparator,
  InputOTPSlot as UiInputOTPSlot,
} from '../../ui/components/ui/input-otp';
import {
  Table as UiTable,
  TableBody as UiTableBody,
  TableCaption as UiTableCaption,
  TableCell as UiTableCell,
  TableFooter as UiTableFooter,
  TableHead as UiTableHead,
  TableHeader as UiTableHeader,
  TableRow as UiTableRow,
} from '../../ui/components/ui/table';
import { ToggleGroup as AppToggleGroup, ToggleGroupItem as AppToggleGroupItem } from '../components/ui/toggle-group';
import {
  ResizableHandle as AppResizableHandle,
  ResizablePanel as AppResizablePanel,
  ResizablePanelGroup as AppResizablePanelGroup,
} from '../components/ui/resizable';
import { Toaster as AppToaster } from '../components/ui/sonner';
import { ToggleGroup as UiToggleGroup, ToggleGroupItem as UiToggleGroupItem } from '../../ui/components/ui/toggle-group';
import {
  ResizableHandle as UiResizableHandle,
  ResizablePanel as UiResizablePanel,
  ResizablePanelGroup as UiResizablePanelGroup,
} from '../../ui/components/ui/resizable';
import { Toaster as UiToaster } from '../../ui/components/ui/sonner';
import { Calendar as AppCalendar } from '../components/ui/calendar';
import { Calendar as UiCalendar } from '../../ui/components/ui/calendar';
import {
  Drawer as AppDrawer,
  DrawerClose as AppDrawerClose,
  DrawerContent as AppDrawerContent,
  DrawerDescription as AppDrawerDescription,
  DrawerFooter as AppDrawerFooter,
  DrawerHeader as AppDrawerHeader,
  DrawerOverlay as AppDrawerOverlay,
  DrawerPortal as AppDrawerPortal,
  DrawerTitle as AppDrawerTitle,
  DrawerTrigger as AppDrawerTrigger,
} from '../components/ui/drawer';
import {
  Drawer as UiDrawer,
  DrawerClose as UiDrawerClose,
  DrawerContent as UiDrawerContent,
  DrawerDescription as UiDrawerDescription,
  DrawerFooter as UiDrawerFooter,
  DrawerHeader as UiDrawerHeader,
  DrawerOverlay as UiDrawerOverlay,
  DrawerPortal as UiDrawerPortal,
  DrawerTitle as UiDrawerTitle,
  DrawerTrigger as UiDrawerTrigger,
} from '../../ui/components/ui/drawer';
import {
  Form as AppForm,
  FormControl as AppFormControl,
  FormDescription as AppFormDescription,
  FormField as AppFormField,
  FormItem as AppFormItem,
  FormLabel as AppFormLabel,
  FormMessage as AppFormMessage,
  useFormField as AppUseFormField,
} from '../components/ui/form';
import {
  Form as UiForm,
  FormControl as UiFormControl,
  FormDescription as UiFormDescription,
  FormField as UiFormField,
  FormItem as UiFormItem,
  FormLabel as UiFormLabel,
  FormMessage as UiFormMessage,
  useFormField as UiUseFormField,
} from '../../ui/components/ui/form';
import {
  NavigationMenu as AppNavigationMenu,
  NavigationMenuContent as AppNavigationMenuContent,
  NavigationMenuIndicator as AppNavigationMenuIndicator,
  NavigationMenuItem as AppNavigationMenuItem,
  NavigationMenuLink as AppNavigationMenuLink,
  NavigationMenuList as AppNavigationMenuList,
  NavigationMenuTrigger as AppNavigationMenuTrigger,
  NavigationMenuViewport as AppNavigationMenuViewport,
  navigationMenuTriggerStyle as AppNavigationMenuTriggerStyle,
} from '../components/ui/navigation-menu';
import {
  NavigationMenu as UiNavigationMenu,
  NavigationMenuContent as UiNavigationMenuContent,
  NavigationMenuIndicator as UiNavigationMenuIndicator,
  NavigationMenuItem as UiNavigationMenuItem,
  NavigationMenuLink as UiNavigationMenuLink,
  NavigationMenuList as UiNavigationMenuList,
  NavigationMenuTrigger as UiNavigationMenuTrigger,
  NavigationMenuViewport as UiNavigationMenuViewport,
  navigationMenuTriggerStyle as UiNavigationMenuTriggerStyle,
} from '../../ui/components/ui/navigation-menu';
import {
  Command as AppCommand,
  CommandDialog as AppCommandDialog,
  CommandEmpty as AppCommandEmpty,
  CommandGroup as AppCommandGroup,
  CommandInput as AppCommandInput,
  CommandItem as AppCommandItem,
  CommandList as AppCommandList,
  CommandSeparator as AppCommandSeparator,
  CommandShortcut as AppCommandShortcut,
} from '../components/ui/command';
import {
  Command as UiCommand,
  CommandDialog as UiCommandDialog,
  CommandEmpty as UiCommandEmpty,
  CommandGroup as UiCommandGroup,
  CommandInput as UiCommandInput,
  CommandItem as UiCommandItem,
  CommandList as UiCommandList,
  CommandSeparator as UiCommandSeparator,
  CommandShortcut as UiCommandShortcut,
} from '../../ui/components/ui/command';
import {
  Select as AppSelect,
  SelectContent as AppSelectContent,
  SelectGroup as AppSelectGroup,
  SelectItem as AppSelectItem,
  SelectLabel as AppSelectLabel,
  SelectScrollDownButton as AppSelectScrollDownButton,
  SelectScrollUpButton as AppSelectScrollUpButton,
  SelectSeparator as AppSelectSeparator,
  SelectTrigger as AppSelectTrigger,
  SelectValue as AppSelectValue,
} from '../components/ui/select';
import {
  Select as UiSelect,
  SelectContent as UiSelectContent,
  SelectGroup as UiSelectGroup,
  SelectItem as UiSelectItem,
  SelectLabel as UiSelectLabel,
  SelectScrollDownButton as UiSelectScrollDownButton,
  SelectScrollUpButton as UiSelectScrollUpButton,
  SelectSeparator as UiSelectSeparator,
  SelectTrigger as UiSelectTrigger,
  SelectValue as UiSelectValue,
} from '../../ui/components/ui/select';

describe('UI primitive re-export stubs', () => {
  it('keeps hover-card exports wired to the new UI layer', () => {
    expect(AppHoverCard).toBe(UiHoverCard);
    expect(AppHoverCardTrigger).toBe(UiHoverCardTrigger);
    expect(AppHoverCardContent).toBe(UiHoverCardContent);
  });

  it('keeps ui/utils wired to the new UI layer', () => {
    expect(AppCn).toBe(UiCn);
  });

  it('keeps common ui primitives wired to the new UI layer', () => {
    expect(AppButton).toBe(UiButton);
    expect(AppButtonVariants).toBe(UiButtonVariants);
    expect(AppBadge).toBe(UiBadge);
    expect(AppBadgeVariants).toBe(UiBadgeVariants);
    expect(AppSeparator).toBe(UiSeparator);
  });

  it('keeps form primitives wired to the new UI layer', () => {
    expect(AppInput).toBe(UiInput);
    expect(AppTextarea).toBe(UiTextarea);
  });

  it('keeps card primitives wired to the new UI layer', () => {
    expect(AppCard).toBe(UiCard);
    expect(AppCardHeader).toBe(UiCardHeader);
    expect(AppCardTitle).toBe(UiCardTitle);
    expect(AppCardDescription).toBe(UiCardDescription);
    expect(AppCardAction).toBe(UiCardAction);
    expect(AppCardContent).toBe(UiCardContent);
    expect(AppCardFooter).toBe(UiCardFooter);
  });

  it('keeps label/skeleton/scroll-area wired to the new UI layer', () => {
    expect(AppLabel).toBe(UiLabel);
    expect(AppSkeleton).toBe(UiSkeleton);
    expect(AppScrollArea).toBe(UiScrollArea);
    expect(AppScrollBar).toBe(UiScrollBar);
  });

  it('keeps popover/tooltip/dialog primitives wired to the new UI layer', () => {
    expect(AppTooltip).toBe(UiTooltip);
    expect(AppTooltipProvider).toBe(UiTooltipProvider);
    expect(AppTooltipTrigger).toBe(UiTooltipTrigger);
    expect(AppTooltipContent).toBe(UiTooltipContent);

    expect(AppPopover).toBe(UiPopover);
    expect(AppPopoverTrigger).toBe(UiPopoverTrigger);
    expect(AppPopoverContent).toBe(UiPopoverContent);
    expect(AppPopoverAnchor).toBe(UiPopoverAnchor);

    expect(AppDialog).toBe(UiDialog);
    expect(AppDialogTrigger).toBe(UiDialogTrigger);
    expect(AppDialogPortal).toBe(UiDialogPortal);
    expect(AppDialogOverlay).toBe(UiDialogOverlay);
    expect(AppDialogClose).toBe(UiDialogClose);
    expect(AppDialogContent).toBe(UiDialogContent);
    expect(AppDialogHeader).toBe(UiDialogHeader);
    expect(AppDialogFooter).toBe(UiDialogFooter);
    expect(AppDialogTitle).toBe(UiDialogTitle);
    expect(AppDialogDescription).toBe(UiDialogDescription);
  });

  it('keeps alert/tabs/sheet primitives wired to the new UI layer', () => {
    expect(AppAlert).toBe(UiAlert);
    expect(AppAlertTitle).toBe(UiAlertTitle);
    expect(AppAlertDescription).toBe(UiAlertDescription);

    expect(AppTabs).toBe(UiTabs);
    expect(AppTabsList).toBe(UiTabsList);
    expect(AppTabsTrigger).toBe(UiTabsTrigger);
    expect(AppTabsContent).toBe(UiTabsContent);

    expect(AppSheet).toBe(UiSheet);
    expect(AppSheetTrigger).toBe(UiSheetTrigger);
    expect(AppSheetClose).toBe(UiSheetClose);
    expect(AppSheetContent).toBe(UiSheetContent);
    expect(AppSheetHeader).toBe(UiSheetHeader);
    expect(AppSheetFooter).toBe(UiSheetFooter);
    expect(AppSheetTitle).toBe(UiSheetTitle);
    expect(AppSheetDescription).toBe(UiSheetDescription);
  });

  it('keeps progress/avatar/aspect-ratio primitives wired to the new UI layer', () => {
    expect(AppProgress).toBe(UiProgress);

    expect(AppAvatar).toBe(UiAvatar);
    expect(AppAvatarImage).toBe(UiAvatarImage);
    expect(AppAvatarFallback).toBe(UiAvatarFallback);

    expect(AppAspectRatio).toBe(UiAspectRatio);
  });

  it('keeps checkbox/collapsible/switch primitives wired to the new UI layer', () => {
    expect(AppCheckbox).toBe(UiCheckbox);

    expect(AppCollapsible).toBe(UiCollapsible);
    expect(AppCollapsibleTrigger).toBe(UiCollapsibleTrigger);
    expect(AppCollapsibleContent).toBe(UiCollapsibleContent);

    expect(AppSwitch).toBe(UiSwitch);
  });

  it('keeps toggle/slider/breadcrumb primitives wired to the new UI layer', () => {
    expect(AppToggle).toBe(UiToggle);
    expect(AppToggleVariants).toBe(UiToggleVariants);

    expect(AppSlider).toBe(UiSlider);

    expect(AppBreadcrumb).toBe(UiBreadcrumb);
    expect(AppBreadcrumbList).toBe(UiBreadcrumbList);
    expect(AppBreadcrumbItem).toBe(UiBreadcrumbItem);
    expect(AppBreadcrumbLink).toBe(UiBreadcrumbLink);
    expect(AppBreadcrumbPage).toBe(UiBreadcrumbPage);
    expect(AppBreadcrumbSeparator).toBe(UiBreadcrumbSeparator);
    expect(AppBreadcrumbEllipsis).toBe(UiBreadcrumbEllipsis);
  });

  it('keeps accordion/alert-dialog/pagination primitives wired to the new UI layer', () => {
    expect(AppAccordion).toBe(UiAccordion);
    expect(AppAccordionItem).toBe(UiAccordionItem);
    expect(AppAccordionTrigger).toBe(UiAccordionTrigger);
    expect(AppAccordionContent).toBe(UiAccordionContent);

    expect(AppAlertDialog).toBe(UiAlertDialog);
    expect(AppAlertDialogPortal).toBe(UiAlertDialogPortal);
    expect(AppAlertDialogOverlay).toBe(UiAlertDialogOverlay);
    expect(AppAlertDialogTrigger).toBe(UiAlertDialogTrigger);
    expect(AppAlertDialogContent).toBe(UiAlertDialogContent);
    expect(AppAlertDialogHeader).toBe(UiAlertDialogHeader);
    expect(AppAlertDialogFooter).toBe(UiAlertDialogFooter);
    expect(AppAlertDialogTitle).toBe(UiAlertDialogTitle);
    expect(AppAlertDialogDescription).toBe(UiAlertDialogDescription);
    expect(AppAlertDialogAction).toBe(UiAlertDialogAction);
    expect(AppAlertDialogCancel).toBe(UiAlertDialogCancel);

    expect(AppPagination).toBe(UiPagination);
    expect(AppPaginationContent).toBe(UiPaginationContent);
    expect(AppPaginationLink).toBe(UiPaginationLink);
    expect(AppPaginationItem).toBe(UiPaginationItem);
    expect(AppPaginationPrevious).toBe(UiPaginationPrevious);
    expect(AppPaginationNext).toBe(UiPaginationNext);
    expect(AppPaginationEllipsis).toBe(UiPaginationEllipsis);
  });

  it('keeps radio-group/input-otp/table primitives wired to the new UI layer', () => {
    expect(AppRadioGroup).toBe(UiRadioGroup);
    expect(AppRadioGroupItem).toBe(UiRadioGroupItem);

    expect(AppInputOTP).toBe(UiInputOTP);
    expect(AppInputOTPGroup).toBe(UiInputOTPGroup);
    expect(AppInputOTPSlot).toBe(UiInputOTPSlot);
    expect(AppInputOTPSeparator).toBe(UiInputOTPSeparator);

    expect(AppTable).toBe(UiTable);
    expect(AppTableHeader).toBe(UiTableHeader);
    expect(AppTableBody).toBe(UiTableBody);
    expect(AppTableFooter).toBe(UiTableFooter);
    expect(AppTableHead).toBe(UiTableHead);
    expect(AppTableRow).toBe(UiTableRow);
    expect(AppTableCell).toBe(UiTableCell);
    expect(AppTableCaption).toBe(UiTableCaption);
  });

  it('keeps toggle-group/resizable/sonner primitives wired to the new UI layer', () => {
    expect(AppToggleGroup).toBe(UiToggleGroup);
    expect(AppToggleGroupItem).toBe(UiToggleGroupItem);

    expect(AppResizablePanelGroup).toBe(UiResizablePanelGroup);
    expect(AppResizablePanel).toBe(UiResizablePanel);
    expect(AppResizableHandle).toBe(UiResizableHandle);

    expect(AppToaster).toBe(UiToaster);
  });

  it('keeps calendar wired to the new UI layer', () => {
    expect(AppCalendar).toBe(UiCalendar);
  });

  it('keeps drawer wired to the new UI layer', () => {
    expect(AppDrawer).toBe(UiDrawer);
    expect(AppDrawerPortal).toBe(UiDrawerPortal);
    expect(AppDrawerOverlay).toBe(UiDrawerOverlay);
    expect(AppDrawerTrigger).toBe(UiDrawerTrigger);
    expect(AppDrawerClose).toBe(UiDrawerClose);
    expect(AppDrawerContent).toBe(UiDrawerContent);
    expect(AppDrawerHeader).toBe(UiDrawerHeader);
    expect(AppDrawerFooter).toBe(UiDrawerFooter);
    expect(AppDrawerTitle).toBe(UiDrawerTitle);
    expect(AppDrawerDescription).toBe(UiDrawerDescription);
  });

  it('keeps form wired to the new UI layer', () => {
    expect(AppUseFormField).toBe(UiUseFormField);
    expect(AppForm).toBe(UiForm);
    expect(AppFormItem).toBe(UiFormItem);
    expect(AppFormLabel).toBe(UiFormLabel);
    expect(AppFormControl).toBe(UiFormControl);
    expect(AppFormDescription).toBe(UiFormDescription);
    expect(AppFormMessage).toBe(UiFormMessage);
    expect(AppFormField).toBe(UiFormField);
  });

  it('keeps navigation-menu wired to the new UI layer', () => {
    expect(AppNavigationMenu).toBe(UiNavigationMenu);
    expect(AppNavigationMenuList).toBe(UiNavigationMenuList);
    expect(AppNavigationMenuItem).toBe(UiNavigationMenuItem);
    expect(AppNavigationMenuContent).toBe(UiNavigationMenuContent);
    expect(AppNavigationMenuTrigger).toBe(UiNavigationMenuTrigger);
    expect(AppNavigationMenuLink).toBe(UiNavigationMenuLink);
    expect(AppNavigationMenuIndicator).toBe(UiNavigationMenuIndicator);
    expect(AppNavigationMenuViewport).toBe(UiNavigationMenuViewport);
    expect(AppNavigationMenuTriggerStyle).toBe(UiNavigationMenuTriggerStyle);
  });

  it('keeps command wired to the new UI layer', () => {
    expect(AppCommand).toBe(UiCommand);
    expect(AppCommandDialog).toBe(UiCommandDialog);
    expect(AppCommandInput).toBe(UiCommandInput);
    expect(AppCommandList).toBe(UiCommandList);
    expect(AppCommandEmpty).toBe(UiCommandEmpty);
    expect(AppCommandGroup).toBe(UiCommandGroup);
    expect(AppCommandItem).toBe(UiCommandItem);
    expect(AppCommandShortcut).toBe(UiCommandShortcut);
    expect(AppCommandSeparator).toBe(UiCommandSeparator);
  });

  it('keeps select wired to the new UI layer', () => {
    expect(AppSelect).toBe(UiSelect);
    expect(AppSelectContent).toBe(UiSelectContent);
    expect(AppSelectGroup).toBe(UiSelectGroup);
    expect(AppSelectItem).toBe(UiSelectItem);
    expect(AppSelectLabel).toBe(UiSelectLabel);
    expect(AppSelectScrollDownButton).toBe(UiSelectScrollDownButton);
    expect(AppSelectScrollUpButton).toBe(UiSelectScrollUpButton);
    expect(AppSelectSeparator).toBe(UiSelectSeparator);
    expect(AppSelectTrigger).toBe(UiSelectTrigger);
    expect(AppSelectValue).toBe(UiSelectValue);
  });
});

