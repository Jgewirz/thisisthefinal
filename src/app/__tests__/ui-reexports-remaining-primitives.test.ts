import { describe, it, expect } from 'vitest';

import { useIsMobile as AppUseIsMobile } from '../components/ui/use-mobile';
import { useIsMobile as UiUseIsMobile } from '../../ui/components/ui/use-mobile';

import {
  Carousel as AppCarousel,
  CarouselContent as AppCarouselContent,
  CarouselItem as AppCarouselItem,
  CarouselNext as AppCarouselNext,
  CarouselPrevious as AppCarouselPrevious,
} from '../components/ui/carousel';
import {
  Carousel as UiCarousel,
  CarouselContent as UiCarouselContent,
  CarouselItem as UiCarouselItem,
  CarouselNext as UiCarouselNext,
  CarouselPrevious as UiCarouselPrevious,
} from '../../ui/components/ui/carousel';

import {
  ContextMenu as AppContextMenu,
  ContextMenuCheckboxItem as AppContextMenuCheckboxItem,
  ContextMenuContent as AppContextMenuContent,
  ContextMenuGroup as AppContextMenuGroup,
  ContextMenuItem as AppContextMenuItem,
  ContextMenuLabel as AppContextMenuLabel,
  ContextMenuPortal as AppContextMenuPortal,
  ContextMenuRadioGroup as AppContextMenuRadioGroup,
  ContextMenuRadioItem as AppContextMenuRadioItem,
  ContextMenuSeparator as AppContextMenuSeparator,
  ContextMenuShortcut as AppContextMenuShortcut,
  ContextMenuSub as AppContextMenuSub,
  ContextMenuSubContent as AppContextMenuSubContent,
  ContextMenuSubTrigger as AppContextMenuSubTrigger,
  ContextMenuTrigger as AppContextMenuTrigger,
} from '../components/ui/context-menu';
import {
  ContextMenu as UiContextMenu,
  ContextMenuCheckboxItem as UiContextMenuCheckboxItem,
  ContextMenuContent as UiContextMenuContent,
  ContextMenuGroup as UiContextMenuGroup,
  ContextMenuItem as UiContextMenuItem,
  ContextMenuLabel as UiContextMenuLabel,
  ContextMenuPortal as UiContextMenuPortal,
  ContextMenuRadioGroup as UiContextMenuRadioGroup,
  ContextMenuRadioItem as UiContextMenuRadioItem,
  ContextMenuSeparator as UiContextMenuSeparator,
  ContextMenuShortcut as UiContextMenuShortcut,
  ContextMenuSub as UiContextMenuSub,
  ContextMenuSubContent as UiContextMenuSubContent,
  ContextMenuSubTrigger as UiContextMenuSubTrigger,
  ContextMenuTrigger as UiContextMenuTrigger,
} from '../../ui/components/ui/context-menu';

import {
  DropdownMenu as AppDropdownMenu,
  DropdownMenuCheckboxItem as AppDropdownMenuCheckboxItem,
  DropdownMenuContent as AppDropdownMenuContent,
  DropdownMenuGroup as AppDropdownMenuGroup,
  DropdownMenuItem as AppDropdownMenuItem,
  DropdownMenuLabel as AppDropdownMenuLabel,
  DropdownMenuPortal as AppDropdownMenuPortal,
  DropdownMenuRadioGroup as AppDropdownMenuRadioGroup,
  DropdownMenuRadioItem as AppDropdownMenuRadioItem,
  DropdownMenuSeparator as AppDropdownMenuSeparator,
  DropdownMenuShortcut as AppDropdownMenuShortcut,
  DropdownMenuSub as AppDropdownMenuSub,
  DropdownMenuSubContent as AppDropdownMenuSubContent,
  DropdownMenuSubTrigger as AppDropdownMenuSubTrigger,
  DropdownMenuTrigger as AppDropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  DropdownMenu as UiDropdownMenu,
  DropdownMenuCheckboxItem as UiDropdownMenuCheckboxItem,
  DropdownMenuContent as UiDropdownMenuContent,
  DropdownMenuGroup as UiDropdownMenuGroup,
  DropdownMenuItem as UiDropdownMenuItem,
  DropdownMenuLabel as UiDropdownMenuLabel,
  DropdownMenuPortal as UiDropdownMenuPortal,
  DropdownMenuRadioGroup as UiDropdownMenuRadioGroup,
  DropdownMenuRadioItem as UiDropdownMenuRadioItem,
  DropdownMenuSeparator as UiDropdownMenuSeparator,
  DropdownMenuShortcut as UiDropdownMenuShortcut,
  DropdownMenuSub as UiDropdownMenuSub,
  DropdownMenuSubContent as UiDropdownMenuSubContent,
  DropdownMenuSubTrigger as UiDropdownMenuSubTrigger,
  DropdownMenuTrigger as UiDropdownMenuTrigger,
} from '../../ui/components/ui/dropdown-menu';

import {
  Menubar as AppMenubar,
  MenubarCheckboxItem as AppMenubarCheckboxItem,
  MenubarContent as AppMenubarContent,
  MenubarGroup as AppMenubarGroup,
  MenubarItem as AppMenubarItem,
  MenubarLabel as AppMenubarLabel,
  MenubarMenu as AppMenubarMenu,
  MenubarPortal as AppMenubarPortal,
  MenubarRadioGroup as AppMenubarRadioGroup,
  MenubarRadioItem as AppMenubarRadioItem,
  MenubarSeparator as AppMenubarSeparator,
  MenubarShortcut as AppMenubarShortcut,
  MenubarSub as AppMenubarSub,
  MenubarSubContent as AppMenubarSubContent,
  MenubarSubTrigger as AppMenubarSubTrigger,
  MenubarTrigger as AppMenubarTrigger,
} from '../components/ui/menubar';
import {
  Menubar as UiMenubar,
  MenubarCheckboxItem as UiMenubarCheckboxItem,
  MenubarContent as UiMenubarContent,
  MenubarGroup as UiMenubarGroup,
  MenubarItem as UiMenubarItem,
  MenubarLabel as UiMenubarLabel,
  MenubarMenu as UiMenubarMenu,
  MenubarPortal as UiMenubarPortal,
  MenubarRadioGroup as UiMenubarRadioGroup,
  MenubarRadioItem as UiMenubarRadioItem,
  MenubarSeparator as UiMenubarSeparator,
  MenubarShortcut as UiMenubarShortcut,
  MenubarSub as UiMenubarSub,
  MenubarSubContent as UiMenubarSubContent,
  MenubarSubTrigger as UiMenubarSubTrigger,
  MenubarTrigger as UiMenubarTrigger,
} from '../../ui/components/ui/menubar';

import {
  ChartContainer as AppChartContainer,
  ChartLegend as AppChartLegend,
  ChartLegendContent as AppChartLegendContent,
  ChartStyle as AppChartStyle,
  ChartTooltip as AppChartTooltip,
  ChartTooltipContent as AppChartTooltipContent,
} from '../components/ui/chart';
import {
  ChartContainer as UiChartContainer,
  ChartLegend as UiChartLegend,
  ChartLegendContent as UiChartLegendContent,
  ChartStyle as UiChartStyle,
  ChartTooltip as UiChartTooltip,
  ChartTooltipContent as UiChartTooltipContent,
} from '../../ui/components/ui/chart';

import {
  Sidebar as AppSidebar,
  SidebarContent as AppSidebarContent,
  SidebarFooter as AppSidebarFooter,
  SidebarGroup as AppSidebarGroup,
  SidebarGroupAction as AppSidebarGroupAction,
  SidebarGroupContent as AppSidebarGroupContent,
  SidebarGroupLabel as AppSidebarGroupLabel,
  SidebarHeader as AppSidebarHeader,
  SidebarInput as AppSidebarInput,
  SidebarInset as AppSidebarInset,
  SidebarMenu as AppSidebarMenu,
  SidebarMenuAction as AppSidebarMenuAction,
  SidebarMenuBadge as AppSidebarMenuBadge,
  SidebarMenuButton as AppSidebarMenuButton,
  SidebarMenuItem as AppSidebarMenuItem,
  SidebarMenuSkeleton as AppSidebarMenuSkeleton,
  SidebarMenuSub as AppSidebarMenuSub,
  SidebarMenuSubButton as AppSidebarMenuSubButton,
  SidebarMenuSubItem as AppSidebarMenuSubItem,
  SidebarProvider as AppSidebarProvider,
  SidebarRail as AppSidebarRail,
  SidebarSeparator as AppSidebarSeparator,
  SidebarTrigger as AppSidebarTrigger,
  useSidebar as AppUseSidebar,
} from '../components/ui/sidebar';
import {
  Sidebar as UiSidebar,
  SidebarContent as UiSidebarContent,
  SidebarFooter as UiSidebarFooter,
  SidebarGroup as UiSidebarGroup,
  SidebarGroupAction as UiSidebarGroupAction,
  SidebarGroupContent as UiSidebarGroupContent,
  SidebarGroupLabel as UiSidebarGroupLabel,
  SidebarHeader as UiSidebarHeader,
  SidebarInput as UiSidebarInput,
  SidebarInset as UiSidebarInset,
  SidebarMenu as UiSidebarMenu,
  SidebarMenuAction as UiSidebarMenuAction,
  SidebarMenuBadge as UiSidebarMenuBadge,
  SidebarMenuButton as UiSidebarMenuButton,
  SidebarMenuItem as UiSidebarMenuItem,
  SidebarMenuSkeleton as UiSidebarMenuSkeleton,
  SidebarMenuSub as UiSidebarMenuSub,
  SidebarMenuSubButton as UiSidebarMenuSubButton,
  SidebarMenuSubItem as UiSidebarMenuSubItem,
  SidebarProvider as UiSidebarProvider,
  SidebarRail as UiSidebarRail,
  SidebarSeparator as UiSidebarSeparator,
  SidebarTrigger as UiSidebarTrigger,
  useSidebar as UiUseSidebar,
} from '../../ui/components/ui/sidebar';

describe('UI remaining primitive re-export stubs', () => {
  it('keeps use-mobile wired to the new UI layer', () => {
    expect(AppUseIsMobile).toBe(UiUseIsMobile);
  });

  it('keeps carousel wired to the new UI layer', () => {
    expect(AppCarousel).toBe(UiCarousel);
    expect(AppCarouselContent).toBe(UiCarouselContent);
    expect(AppCarouselItem).toBe(UiCarouselItem);
    expect(AppCarouselPrevious).toBe(UiCarouselPrevious);
    expect(AppCarouselNext).toBe(UiCarouselNext);
  });

  it('keeps context-menu wired to the new UI layer', () => {
    expect(AppContextMenu).toBe(UiContextMenu);
    expect(AppContextMenuTrigger).toBe(UiContextMenuTrigger);
    expect(AppContextMenuContent).toBe(UiContextMenuContent);
    expect(AppContextMenuItem).toBe(UiContextMenuItem);
    expect(AppContextMenuCheckboxItem).toBe(UiContextMenuCheckboxItem);
    expect(AppContextMenuRadioItem).toBe(UiContextMenuRadioItem);
    expect(AppContextMenuLabel).toBe(UiContextMenuLabel);
    expect(AppContextMenuSeparator).toBe(UiContextMenuSeparator);
    expect(AppContextMenuShortcut).toBe(UiContextMenuShortcut);
    expect(AppContextMenuGroup).toBe(UiContextMenuGroup);
    expect(AppContextMenuPortal).toBe(UiContextMenuPortal);
    expect(AppContextMenuSub).toBe(UiContextMenuSub);
    expect(AppContextMenuSubContent).toBe(UiContextMenuSubContent);
    expect(AppContextMenuSubTrigger).toBe(UiContextMenuSubTrigger);
    expect(AppContextMenuRadioGroup).toBe(UiContextMenuRadioGroup);
  });

  it('keeps dropdown-menu wired to the new UI layer', () => {
    expect(AppDropdownMenu).toBe(UiDropdownMenu);
    expect(AppDropdownMenuPortal).toBe(UiDropdownMenuPortal);
    expect(AppDropdownMenuTrigger).toBe(UiDropdownMenuTrigger);
    expect(AppDropdownMenuContent).toBe(UiDropdownMenuContent);
    expect(AppDropdownMenuGroup).toBe(UiDropdownMenuGroup);
    expect(AppDropdownMenuLabel).toBe(UiDropdownMenuLabel);
    expect(AppDropdownMenuItem).toBe(UiDropdownMenuItem);
    expect(AppDropdownMenuCheckboxItem).toBe(UiDropdownMenuCheckboxItem);
    expect(AppDropdownMenuRadioGroup).toBe(UiDropdownMenuRadioGroup);
    expect(AppDropdownMenuRadioItem).toBe(UiDropdownMenuRadioItem);
    expect(AppDropdownMenuSeparator).toBe(UiDropdownMenuSeparator);
    expect(AppDropdownMenuShortcut).toBe(UiDropdownMenuShortcut);
    expect(AppDropdownMenuSub).toBe(UiDropdownMenuSub);
    expect(AppDropdownMenuSubTrigger).toBe(UiDropdownMenuSubTrigger);
    expect(AppDropdownMenuSubContent).toBe(UiDropdownMenuSubContent);
  });

  it('keeps menubar wired to the new UI layer', () => {
    expect(AppMenubar).toBe(UiMenubar);
    expect(AppMenubarPortal).toBe(UiMenubarPortal);
    expect(AppMenubarMenu).toBe(UiMenubarMenu);
    expect(AppMenubarTrigger).toBe(UiMenubarTrigger);
    expect(AppMenubarContent).toBe(UiMenubarContent);
    expect(AppMenubarGroup).toBe(UiMenubarGroup);
    expect(AppMenubarSeparator).toBe(UiMenubarSeparator);
    expect(AppMenubarLabel).toBe(UiMenubarLabel);
    expect(AppMenubarItem).toBe(UiMenubarItem);
    expect(AppMenubarShortcut).toBe(UiMenubarShortcut);
    expect(AppMenubarCheckboxItem).toBe(UiMenubarCheckboxItem);
    expect(AppMenubarRadioGroup).toBe(UiMenubarRadioGroup);
    expect(AppMenubarRadioItem).toBe(UiMenubarRadioItem);
    expect(AppMenubarSub).toBe(UiMenubarSub);
    expect(AppMenubarSubTrigger).toBe(UiMenubarSubTrigger);
    expect(AppMenubarSubContent).toBe(UiMenubarSubContent);
  });

  it('keeps chart wired to the new UI layer', () => {
    expect(AppChartContainer).toBe(UiChartContainer);
    expect(AppChartTooltip).toBe(UiChartTooltip);
    expect(AppChartTooltipContent).toBe(UiChartTooltipContent);
    expect(AppChartLegend).toBe(UiChartLegend);
    expect(AppChartLegendContent).toBe(UiChartLegendContent);
    expect(AppChartStyle).toBe(UiChartStyle);
  });

  it('keeps sidebar wired to the new UI layer', () => {
    expect(AppUseSidebar).toBe(UiUseSidebar);
    expect(AppSidebar).toBe(UiSidebar);
    expect(AppSidebarContent).toBe(UiSidebarContent);
    expect(AppSidebarFooter).toBe(UiSidebarFooter);
    expect(AppSidebarGroup).toBe(UiSidebarGroup);
    expect(AppSidebarGroupAction).toBe(UiSidebarGroupAction);
    expect(AppSidebarGroupContent).toBe(UiSidebarGroupContent);
    expect(AppSidebarGroupLabel).toBe(UiSidebarGroupLabel);
    expect(AppSidebarHeader).toBe(UiSidebarHeader);
    expect(AppSidebarInput).toBe(UiSidebarInput);
    expect(AppSidebarInset).toBe(UiSidebarInset);
    expect(AppSidebarMenu).toBe(UiSidebarMenu);
    expect(AppSidebarMenuAction).toBe(UiSidebarMenuAction);
    expect(AppSidebarMenuBadge).toBe(UiSidebarMenuBadge);
    expect(AppSidebarMenuButton).toBe(UiSidebarMenuButton);
    expect(AppSidebarMenuItem).toBe(UiSidebarMenuItem);
    expect(AppSidebarMenuSkeleton).toBe(UiSidebarMenuSkeleton);
    expect(AppSidebarMenuSub).toBe(UiSidebarMenuSub);
    expect(AppSidebarMenuSubButton).toBe(UiSidebarMenuSubButton);
    expect(AppSidebarMenuSubItem).toBe(UiSidebarMenuSubItem);
    expect(AppSidebarProvider).toBe(UiSidebarProvider);
    expect(AppSidebarRail).toBe(UiSidebarRail);
    expect(AppSidebarSeparator).toBe(UiSidebarSeparator);
    expect(AppSidebarTrigger).toBe(UiSidebarTrigger);
  });
});
