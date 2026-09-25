"use client";

import { HTMLAttributes, ReactNode } from "react";
import { useListView } from "./useListView";

type CardListProps = {
  children: ReactNode;
  className?: string;
  /** Element tag; defaults to ul for semantic lists */
  as?: "ul" | "div";
};

/**
 * Responsive card container. List = single column; grid = 1/2/3 cols.
 * Preference comes from useListView (localStorage `adnabbit-list-view`).
 */
export function CardList({
  children,
  className = "",
  as: Tag = "ul",
}: CardListProps) {
  const { view } = useListView();

  const layout =
    view === "grid"
      ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      : "grid grid-cols-1 gap-3";

  return (
    <Tag
      data-list-view={view}
      className={`${layout} ${className}`.trim()}
    >
      {children}
    </Tag>
  );
}

type CardListItemProps = HTMLAttributes<HTMLLIElement> & {
  children: ReactNode;
};

/** List item that stretches to fill the grid cell height. */
export function CardListItem({
  children,
  className = "",
  ...props
}: CardListItemProps) {
  return (
    <li className={`min-w-0 h-full ${className}`.trim()} {...props}>
      {children}
    </li>
  );
}
