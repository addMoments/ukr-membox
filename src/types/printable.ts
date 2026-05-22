import {FC, ReactElement} from "react";
import { AdminTheme, GuestTheme } from "./guestTheme";

export interface Printable {
    colors: GuestTheme;
    component: ({ colors }: { colors: GuestTheme; }) => ReactElement;
    name: string;
    themeOptions: AdminTheme[];
}