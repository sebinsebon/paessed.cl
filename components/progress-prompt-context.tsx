"use client";
import { createContext, useContext } from "react";
export const ProgressPromptContext = createContext(false);
export function useProgressPromptPending() { return useContext(ProgressPromptContext); }
